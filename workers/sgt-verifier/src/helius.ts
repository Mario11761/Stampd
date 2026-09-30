import { address, type Address } from "@solana/kit";
import {
  HELIUS_MAINNET_RPC_ORIGIN,
  RPC_RESPONSE_LIMIT_CHARACTERS,
  RPC_TIMEOUT_MS,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_ACCOUNT_PAGE_SIZE,
} from "./constants";
import { SafeError } from "./errors";
import type { MintAccountValue, SgtRpcClient, TokenAccountPage } from "./types";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class HeliusRpcClient implements SgtRpcClient {
  readonly #fetch: Fetcher;
  readonly #rpcUrl: string;
  readonly #rpcTimeoutMs: number;
  #requestNumber = 0;

  constructor(apiKey: string, fetcher: Fetcher, rpcTimeoutMs = RPC_TIMEOUT_MS) {
    if (apiKey.length === 0) {
      throw new SafeError(
        "SERVER_CONFIGURATION_ERROR",
        503,
        true,
        "configuration",
      );
    }

    const rpcUrl = new URL(HELIUS_MAINNET_RPC_ORIGIN);
    rpcUrl.searchParams.set("api-key", apiKey);
    this.#rpcUrl = rpcUrl.toString();
    this.#fetch = fetcher;
    this.#rpcTimeoutMs = rpcTimeoutMs;
  }

  async getObservedSlot(signal: AbortSignal): Promise<number> {
    const envelope = await this.#callRpc(
      "getSlot",
      [{ commitment: "finalized" }],
      signal,
    );
    if (!Number.isSafeInteger(envelope.result) || Number(envelope.result) < 0) {
      throw malformedRpc("slot");
    }
    return Number(envelope.result);
  }

  async getTokenAccountPage(
    walletAddress: Address,
    paginationKey: string | undefined,
    minContextSlot: number,
    signal: AbortSignal,
  ): Promise<TokenAccountPage> {
    const config: Record<string, unknown> = {
      commitment: "finalized",
      encoding: "jsonParsed",
      limit: TOKEN_ACCOUNT_PAGE_SIZE,
      minContextSlot,
      withContext: false,
    };
    if (paginationKey !== undefined) {
      config.paginationKey = paginationKey;
    }

    const envelope = await this.#callRpc(
      "getTokenAccountsByOwnerV2",
      [walletAddress, { programId: TOKEN_2022_PROGRAM_ID }, config],
      signal,
    );
    return parseTokenAccountPageResult(envelope.result);
  }

  async getMintAccounts(
    mintAddresses: readonly Address[],
    minContextSlot: number,
    signal: AbortSignal,
  ): Promise<(MintAccountValue | null)[]> {
    const envelope = await this.#callRpc(
      "getMultipleAccounts",
      [
        mintAddresses,
        {
          commitment: "finalized",
          encoding: "base64",
          minContextSlot,
        },
      ],
      signal,
    );
    const result = envelope.result;
    if (
      !isRecord(result) ||
      !Array.isArray(result.value) ||
      result.value.length !== mintAddresses.length
    ) {
      throw malformedRpc("mint_batch");
    }

    return result.value.map((value): MintAccountValue | null => {
      if (value === null) {
        return null;
      }
      if (
        !isRecord(value) ||
        typeof value.owner !== "string" ||
        !Array.isArray(value.data)
      ) {
        throw malformedRpc("mint_batch");
      }
      const [encodedData, encoding, ...extraData] = value.data;
      if (
        typeof encodedData !== "string" ||
        encoding !== "base64" ||
        extraData.length !== 0 ||
        encodedData.length > 1_000_000
      ) {
        throw malformedRpc("mint_batch");
      }

      return {
        data: decodeBase64(encodedData),
        owner: value.owner,
      };
    });
  }

  async #callRpc(
    method: string,
    params: unknown[],
    parentSignal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const id = `stampd-${++this.#requestNumber}`;
    const controller = new AbortController();
    const abortFromParent = () => controller.abort();
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", abortFromParent, { once: true });
    }
    const timeout = setTimeout(() => controller.abort(), this.#rpcTimeoutMs);

    try {
      const response = await this.#fetch(this.#rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new SafeError("UPSTREAM_HTTP_ERROR", 503, true, "upstream_http");
      }

      const declaredLength = response.headers.get("content-length");
      if (
        declaredLength !== null &&
        (/^\d+$/.test(declaredLength) === false ||
          Number(declaredLength) > RPC_RESPONSE_LIMIT_CHARACTERS)
      ) {
        throw malformedRpc();
      }

      const responseText = await readResponseText(
        response,
        RPC_RESPONSE_LIMIT_CHARACTERS,
      );

      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw malformedRpc();
      }

      if (
        !isRecord(data) ||
        data.jsonrpc !== "2.0" ||
        data.id !== id ||
        data.error !== undefined
      ) {
        if (isRecord(data) && data.error !== undefined) {
          const rpcErrorCategory = safeRpcErrorCategory(data.error);
          const rpcStage = safeRpcStage(method);
          throw new SafeError(
            `UPSTREAM_RPC_${rpcErrorCategory}_${rpcStage.toUpperCase()}`,
            503,
            true,
            `upstream_rpc_${rpcErrorCategory.toLowerCase()}_${rpcStage}`,
          );
        }
        throw malformedRpc();
      }
      if (!Object.prototype.hasOwnProperty.call(data, "result")) {
        throw malformedRpc();
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof SafeError) {
        if (
          error.code === "MALFORMED_UPSTREAM_RESPONSE" &&
          error.failureCategory === "upstream_schema"
        ) {
          throw new SafeError(
            `MALFORMED_UPSTREAM_RESPONSE_${safeRpcStage(method).toUpperCase()}`,
            error.httpStatus,
            error.retryable,
            `upstream_schema_${safeRpcStage(method)}`,
          );
        }
        throw error;
      }
      if (controller.signal.aborted) {
        throw new SafeError("UPSTREAM_TIMEOUT", 504, true, "timeout");
      }
      throw new SafeError(
        "UPSTREAM_UNAVAILABLE",
        503,
        true,
        "upstream_network",
      );
    } finally {
      clearTimeout(timeout);
      parentSignal.removeEventListener("abort", abortFromParent);
    }
  }
}

function parseTokenAccountPageResult(result: unknown): TokenAccountPage {
  if (!isRecord(result)) {
    throw malformedRpc("token_page_result");
  }

  let accounts: unknown[];
  let nextPaginationKey: unknown;
  if (Array.isArray(result.value)) {
    if (result.context !== undefined) {
      throw malformedRpc("token_page_context");
    }
    accounts = result.value;
    nextPaginationKey = result.paginationKey;
  } else if (isRecord(result.value)) {
    if (!isRecord(result.context)) {
      throw malformedRpc("token_page_context");
    }
    if (!Array.isArray(result.value.accounts)) {
      throw malformedRpc("token_page_accounts");
    }
    accounts = result.value.accounts;
    nextPaginationKey = result.value.paginationKey;
  } else {
    throw malformedRpc("token_page_value");
  }

  if (nextPaginationKey !== undefined && nextPaginationKey !== null) {
    if (
      typeof nextPaginationKey !== "string" ||
      nextPaginationKey.length === 0 ||
      nextPaginationKey.length > 256 ||
      !/^[1-9A-HJ-NP-Za-km-z]+$/.test(nextPaginationKey)
    ) {
      throw malformedRpc("token_page_pagination");
    }
  }

  return {
    accounts,
    paginationKey:
      typeof nextPaginationKey === "string" ? nextPaginationKey : null,
  };
}

function safeRpcErrorCategory(value: unknown): string {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.code) ||
    Number(value.code) === 0
  ) {
    return "ERROR";
  }

  switch (value.code) {
    case -32601:
      return "METHOD_UNAVAILABLE";
    case -32602:
      return "INVALID_PARAMS";
    case -32001:
      return "UNAUTHORIZED";
    case -32002:
      return "UNAVAILABLE";
    case -32003:
      return "TIMEOUT";
    case -32005:
      return "RATE_LIMITED";
    default:
      return `${Number(value.code) < 0 ? "NEG" : "POS"}_${Math.abs(
        Number(value.code),
      )}`;
  }
}

function safeRpcStage(method: string): string {
  switch (method) {
    case "getSlot":
      return "slot";
    case "getTokenAccountsByOwnerV2":
      return "token_page";
    case "getMultipleAccounts":
      return "mint_batch";
    default:
      return "unknown";
  }
}

async function readResponseText(
  response: Response,
  limitBytes: number,
): Promise<string> {
  if (response.body === null) {
    throw malformedRpc();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > limitBytes) {
        await reader.cancel().catch(() => undefined);
        throw malformedRpc();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
      bytes,
    );
  } catch {
    throw malformedRpc();
  }
}

function decodeBase64(value: string): Uint8Array {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw malformedRpc("mint_batch");
  }

  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw malformedRpc("mint_batch");
  }
}

function malformedRpc(stage?: string): SafeError {
  const suffix = stage === undefined ? "" : `_${stage.toUpperCase()}`;
  return new SafeError(
    `MALFORMED_UPSTREAM_RESPONSE${suffix}`,
    502,
    true,
    stage === undefined ? "upstream_schema" : `upstream_schema_${stage}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertAddress(value: string): Address {
  try {
    return address(value);
  } catch {
    throw malformedRpc();
  }
}
