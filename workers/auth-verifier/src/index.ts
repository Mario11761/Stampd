import {
  CHALLENGE_ENDPOINT_PATH,
  VERIFY_ENDPOINT_PATH,
  WALLET_CONTROL_PROOF_TTL_MS,
} from "./constants";
import { createChallenge, publicChallenge } from "./challenge";
import { asSafeError, SafeError } from "./errors";
import { readWalletAddress } from "./input";
import { verifyWalletControl } from "./siws";
import { readVerifyRequest } from "./verifyInput";
import type {
  ChallengeLookupResult,
  ChallengeResponse,
  ConsumeResult,
  Env,
  SafeLogEvent,
  StoredChallenge,
  UnableResponse,
  WalletControlVerifiedResponse,
  WorkerDependencies,
} from "./types";

const MAX_REQUEST_ID_COLLISION_RETRIES = 3;

const defaultDependencies: WorkerDependencies = {
  now: () => new Date(),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  hashIdentifier: async (value) => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  },
  log: (event) => console.info(JSON.stringify(event)),
};

export function createWorker(
  dependencies: WorkerDependencies = defaultDependencies,
) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const startedAt = dependencies.now().getTime();
      let correlationId: string | undefined;
      let fallbackCode:
        | "CHALLENGE_STORAGE_ERROR"
        | "VERIFICATION_STORAGE_ERROR" = "CHALLENGE_STORAGE_ERROR";

      try {
        const url = new URL(request.url);
        if (
          ![CHALLENGE_ENDPOINT_PATH, VERIFY_ENDPOINT_PATH].includes(
            url.pathname,
          ) ||
          url.search.length > 0
        ) {
          throw new SafeError("NOT_FOUND", 404, false, "request");
        }
        fallbackCode =
          url.pathname === VERIFY_ENDPOINT_PATH
            ? "VERIFICATION_STORAGE_ERROR"
            : "CHALLENGE_STORAGE_ERROR";
        if (request.method !== "POST") {
          throw new SafeError("METHOD_NOT_ALLOWED", 405, false, "request");
        }
        assertBindings(env);

        const clientKey = await dependencies.hashIdentifier(
          request.headers.get("CF-Connecting-IP") ?? "unknown-client",
        );
        if (url.pathname === CHALLENGE_ENDPOINT_PATH) {
          await enforceRateLimit(env, `client:${clientKey}`);

          const walletAddress = await readWalletAddress(request);
          const walletKey = await dependencies.hashIdentifier(walletAddress);
          await enforceRateLimit(env, `wallet:${walletKey}`);

          let storedChallenge: StoredChallenge | undefined;
          for (
            let attempt = 0;
            attempt < MAX_REQUEST_ID_COLLISION_RETRIES;
            attempt += 1
          ) {
            const candidate = createChallenge(
              walletAddress,
              dependencies.now(),
              dependencies.randomBytes,
            );
            correlationId = (
              await dependencies.hashIdentifier(candidate.requestId)
            ).slice(0, 16);
            if (await persistChallenge(env, candidate)) {
              storedChallenge = candidate;
              break;
            }
          }
          if (storedChallenge === undefined) {
            throw new SafeError(
              "CHALLENGE_STORAGE_ERROR",
              503,
              true,
              "storage",
            );
          }

          const result: ChallengeResponse = {
            schemaVersion: 1,
            status: "issued",
            challenge: publicChallenge(storedChallenge),
          };
          logSafe(dependencies, {
            correlationId,
            httpStatus: 201,
            code: "CHALLENGE_ISSUED",
            stage: "complete",
            durationMs: elapsedMs(dependencies, startedAt),
          });
          return jsonResponse(result, 201);
        }

        await enforceRateLimit(env, `verify-client:${clientKey}`);
        const verificationRequest = await readVerifyRequest(request);
        correlationId = (
          await dependencies.hashIdentifier(verificationRequest.requestId)
        ).slice(0, 16);
        const walletKey = await dependencies.hashIdentifier(
          verificationRequest.address,
        );
        await enforceRateLimit(env, `verify-wallet:${walletKey}`);

        const lookup = await lookupChallenge(
          env,
          verificationRequest.requestId,
          dependencies.now(),
        );
        const challenge = requireIssuedChallenge(lookup);
        await verifyWalletControl(challenge, verificationRequest);

        const verifiedAtDate = dependencies.now();
        const consumeResult = await consumeChallenge(
          env,
          verificationRequest.requestId,
          verifiedAtDate,
        );
        requireSuccessfulConsumption(consumeResult);

        const result: WalletControlVerifiedResponse = {
          schemaVersion: 1,
          status: "wallet_control_verified",
          address: challenge.address,
          verifiedAt: verifiedAtDate.toISOString(),
          proofExpiresAt: new Date(
            verifiedAtDate.getTime() + WALLET_CONTROL_PROOF_TTL_MS,
          ).toISOString(),
        };
        logSafe(dependencies, {
          correlationId,
          httpStatus: 200,
          code: "WALLET_CONTROL_VERIFIED",
          stage: "complete",
          durationMs: elapsedMs(dependencies, startedAt),
        });
        return jsonResponse(result, 200);
      } catch (error: unknown) {
        const safeError = asSafeError(error, fallbackCode);
        logSafe(dependencies, {
          correlationId,
          httpStatus: safeError.httpStatus,
          code: safeError.code,
          stage: safeError.stage,
          durationMs: elapsedMs(dependencies, startedAt),
        });
        const result: UnableResponse = {
          schemaVersion: 1,
          status: "unable",
          code: safeError.code,
          retryable: safeError.retryable,
        };
        return jsonResponse(
          result,
          safeError.httpStatus,
          safeError.code === "METHOD_NOT_ALLOWED" ? { Allow: "POST" } : {},
        );
      }
    },
  };
}

async function enforceRateLimit(env: Env, key: string): Promise<void> {
  let result: { success: boolean };
  try {
    result = await env.SIWS_RATE_LIMITER.limit({ key });
  } catch {
    throw new SafeError("SERVER_CONFIGURATION_ERROR", 503, true, "rate_limit");
  }
  if (!result.success) {
    throw new SafeError("RATE_LIMITED", 429, true, "rate_limit");
  }
}

async function persistChallenge(
  env: Env,
  challenge: StoredChallenge,
): Promise<boolean> {
  try {
    const id = env.SIWS_CHALLENGES.idFromName(challenge.requestId);
    const stub = env.SIWS_CHALLENGES.get(id);
    return await stub.initialize(challenge);
  } catch (error: unknown) {
    if (error instanceof SafeError) {
      throw error;
    }
    throw new SafeError("CHALLENGE_STORAGE_ERROR", 503, true, "storage");
  }
}

async function lookupChallenge(
  env: Env,
  requestId: string,
  now: Date,
): Promise<ChallengeLookupResult> {
  try {
    const id = env.SIWS_CHALLENGES.idFromName(requestId);
    return await env.SIWS_CHALLENGES.get(id).getForVerification(
      now.toISOString(),
    );
  } catch {
    throw new SafeError("VERIFICATION_STORAGE_ERROR", 503, true, "storage");
  }
}

async function consumeChallenge(
  env: Env,
  requestId: string,
  now: Date,
): Promise<ConsumeResult> {
  try {
    const id = env.SIWS_CHALLENGES.idFromName(requestId);
    return await env.SIWS_CHALLENGES.get(id).consume(now.toISOString());
  } catch {
    throw new SafeError("VERIFICATION_STORAGE_ERROR", 503, true, "storage");
  }
}

function requireIssuedChallenge(
  result: ChallengeLookupResult,
): StoredChallenge {
  switch (result.status) {
    case "issued":
      return result.challenge;
    case "not_found":
      throw new SafeError("CHALLENGE_NOT_FOUND", 404, false, "verification");
    case "expired":
      throw new SafeError("CHALLENGE_EXPIRED", 410, false, "verification");
    case "already_consumed":
      throw new SafeError("CHALLENGE_ALREADY_USED", 409, false, "verification");
  }
}

function requireSuccessfulConsumption(result: ConsumeResult): void {
  switch (result) {
    case "consumed":
      return;
    case "already_consumed":
      throw new SafeError("CHALLENGE_ALREADY_USED", 409, false, "verification");
    case "expired":
      throw new SafeError("CHALLENGE_EXPIRED", 410, false, "verification");
    case "not_found":
      throw new SafeError("VERIFICATION_STORAGE_ERROR", 503, true, "storage");
  }
}

function assertBindings(env: Env): void {
  if (
    !env.SIWS_CHALLENGES ||
    typeof env.SIWS_CHALLENGES.idFromName !== "function" ||
    typeof env.SIWS_CHALLENGES.get !== "function" ||
    !env.SIWS_RATE_LIMITER ||
    typeof env.SIWS_RATE_LIMITER.limit !== "function"
  ) {
    throw new SafeError("SERVER_CONFIGURATION_ERROR", 503, true, "storage");
  }
}

function jsonResponse(
  body: ChallengeResponse | UnableResponse | WalletControlVerifiedResponse,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
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

export { SiwsChallengeObject } from "./durableObject";

export default createWorker();
