import { NETWORK, OVERALL_TIMEOUT_MS, SGT_ENDPOINT_PATH } from "./constants";
import { asSafeError, SafeError } from "./errors";
import { HeliusRpcClient } from "./helius";
import { readWalletAddress } from "./input";
import type {
  Env,
  SafeLogEvent,
  SgtCheckResult,
  UnableResult,
  WorkerDependencies,
} from "./types";
import { verifySgtOwnership } from "./verifySgt";

const defaultDependencies: WorkerDependencies = {
  fetch: (input, init) => fetch(input, init),
  now: () => new Date(),
  randomUUID: () => crypto.randomUUID(),
  log: (event) => console.info(JSON.stringify(event)),
};

export function createWorker(
  dependencies: WorkerDependencies = defaultDependencies,
) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const startedAt = dependencies.now().getTime();
      const requestId = dependencies.randomUUID();
      let pageCount: number | undefined;
      let candidateCount: number | undefined;

      try {
        const url = new URL(request.url);
        if (url.pathname !== SGT_ENDPOINT_PATH || url.search.length > 0) {
          throw new SafeError("NOT_FOUND", 404, false, "request");
        }
        if (request.method !== "POST") {
          throw new SafeError("METHOD_NOT_ALLOWED", 405, false, "request");
        }

        if (env.SGT_RATE_LIMITER) {
          const rateLimitKey =
            request.headers.get("CF-Connecting-IP") ?? "unknown-client";
          const rateLimit = await env.SGT_RATE_LIMITER.limit({
            key: rateLimitKey,
          });
          if (!rateLimit.success) {
            const result = unableResult("RATE_LIMITED", true, requestId);
            logSafe(dependencies, {
              requestId,
              outcome: "rate_limited",
              durationMs: elapsedMs(dependencies, startedAt),
              failureCategory: "rate_limit",
            });
            return jsonResponse(result, 429, { "Retry-After": "60" });
          }
        }

        const walletAddress = await readWalletAddress(request);
        if (!env.HELIUS_API_KEY) {
          throw new SafeError(
            "SERVER_CONFIGURATION_ERROR",
            503,
            true,
            "configuration",
          );
        }

        const controller = new AbortController();
        const overallTimeout = setTimeout(
          () => controller.abort(),
          OVERALL_TIMEOUT_MS,
        );
        try {
          const rpc = new HeliusRpcClient(
            env.HELIUS_API_KEY,
            dependencies.fetch,
          );
          const verification = await verifySgtOwnership(
            walletAddress,
            rpc,
            controller.signal,
          );
          pageCount = verification.stats.pageCount;
          candidateCount = verification.stats.candidateCount;
          const checkedAt = dependencies.now().toISOString();
          const result: SgtCheckResult =
            verification.status === "detected"
              ? {
                  schemaVersion: 1,
                  status: "detected",
                  network: NETWORK,
                  sgtMintAddresses: verification.sgtMintAddresses,
                  observedSlot: verification.observedSlot,
                  checkedAt,
                }
              : {
                  schemaVersion: 1,
                  status: "not_detected",
                  network: NETWORK,
                  sgtMintAddresses: [],
                  observedSlot: verification.observedSlot,
                  checkedAt,
                };

          logSafe(dependencies, {
            requestId,
            outcome: result.status,
            durationMs: elapsedMs(dependencies, startedAt),
            pageCount,
            candidateCount,
          });
          return jsonResponse(result, 200);
        } finally {
          clearTimeout(overallTimeout);
        }
      } catch (error: unknown) {
        const safeError = asSafeError(error);
        const result = unableResult(
          safeError.code,
          safeError.retryable,
          requestId,
        );
        logSafe(dependencies, {
          requestId,
          outcome: "unable",
          durationMs: elapsedMs(dependencies, startedAt),
          failureCategory: safeError.failureCategory,
          pageCount,
          candidateCount,
        });
        return jsonResponse(
          result,
          safeError.httpStatus,
          safeError.code === "METHOD_NOT_ALLOWED" ? { Allow: "POST" } : {},
        );
      }
    },
  };
}

function unableResult(
  code: string,
  retryable: boolean,
  requestId: string,
): UnableResult {
  return { schemaVersion: 1, status: "unable", code, retryable, requestId };
}

function jsonResponse(
  result: SgtCheckResult,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(result), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function elapsedMs(
  dependencies: WorkerDependencies,
  startedAt: number,
): number {
  return Math.max(0, dependencies.now().getTime() - startedAt);
}

function logSafe(dependencies: WorkerDependencies, event: SafeLogEvent): void {
  dependencies.log(event);
}

export default createWorker();
