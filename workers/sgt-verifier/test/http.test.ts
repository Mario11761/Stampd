import { describe, expect, it } from "vitest";
import { createWorker } from "../src/index";
import type { Env, SafeLogEvent, WorkerDependencies } from "../src/types";
import {
  FIRST_MINT_ADDRESS,
  WALLET_ADDRESS,
  makeDependencies,
  mintAccount,
  rpcResponse,
  toBase64,
  tokenAccount,
} from "./helpers";

const endpoint = "https://sgt.stampdpass.com/v1/sgt/check";

describe("Stage 5A HTTP boundary", () => {
  it.each([
    ["empty body", "", "application/json", 400, "EMPTY_REQUEST"],
    ["malformed JSON", "{", "application/json", 400, "MALFORMED_JSON"],
    ["null", "null", "application/json", 400, "INVALID_REQUEST"],
    ["array", "[]", "application/json", 400, "INVALID_REQUEST"],
    [
      "empty address",
      '{"walletAddress":""}',
      "application/json",
      400,
      "INVALID_WALLET_ADDRESS",
    ],
    [
      "malformed address",
      '{"walletAddress":"not-an-address"}',
      "application/json",
      400,
      "INVALID_WALLET_ADDRESS",
    ],
    [
      "whitespace-padded address",
      `{"walletAddress":" ${WALLET_ADDRESS}"}`,
      "application/json",
      400,
      "INVALID_WALLET_ADDRESS",
    ],
    [
      "extra property",
      `{"walletAddress":"${WALLET_ADDRESS}","rpcUrl":"https://attacker.invalid"}`,
      "application/json",
      400,
      "INVALID_REQUEST",
    ],
    [
      "wrong content type",
      `{"walletAddress":"${WALLET_ADDRESS}"}`,
      "text/plain",
      415,
      "UNSUPPORTED_CONTENT_TYPE",
    ],
  ])("rejects %s", async (_label, body, contentType, status, code) => {
    const worker = createWorker(makeDependencies(neverFetch));
    const response = await worker.fetch(
      new Request(endpoint, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      }),
      env(),
    );
    const result = await response.json();

    expect(response.status).toBe(status);
    expect(result).toMatchObject({ schemaVersion: 1, status: "unable", code });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects an oversized body", async () => {
    const worker = createWorker(makeDependencies(neverFetch));
    const response = await worker.fetch(
      new Request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: WALLET_ADDRESS,
          padding: "x".repeat(300),
        }),
      }),
      env(),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      status: "unable",
      code: "REQUEST_TOO_LARGE",
    });
  });

  it("rejects a wrong method without making an RPC request", async () => {
    const worker = createWorker(makeDependencies(neverFetch));
    const response = await worker.fetch(
      new Request(endpoint, { method: "GET" }),
      env(),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(response.json()).resolves.toMatchObject({
      status: "unable",
      code: "METHOD_NOT_ALLOWED",
    });
  });

  it("returns not_detected only after a successful complete mainnet read", async () => {
    const logs: SafeLogEvent[] = [];
    const worker = createWorker(makeDependencies(noSgtFetch, logs));
    const response = await worker.fetch(validRequest(), env());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      schemaVersion: 1,
      status: "not_detected",
      network: "solana:mainnet",
      sgtMintAddresses: [],
      observedSlot: 123,
      checkedAt: "2026-09-17T04:00:00.000Z",
    });
    expect(logs).toEqual([
      expect.objectContaining({
        outcome: "not_detected",
        pageCount: 1,
        candidateCount: 0,
      }),
    ]);
  });

  it("returns detected with a genuine decoded SGT mint", async () => {
    const worker = createWorker(makeDependencies(genuineSgtFetch));
    const response = await worker.fetch(validRequest(), env());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 1,
      status: "detected",
      network: "solana:mainnet",
      sgtMintAddresses: [FIRST_MINT_ADDRESS],
      observedSlot: 123,
    });
  });

  it("maps backend failure to unable rather than not_detected", async () => {
    const worker = createWorker(
      makeDependencies(
        async () => new Response("provider unavailable", { status: 503 }),
      ),
    );
    const response = await worker.fetch(validRequest(), env());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "unable",
      code: "UPSTREAM_HTTP_ERROR",
      retryable: true,
    });
  });

  it("rate-limits without making an RPC request", async () => {
    const worker = createWorker(makeDependencies(neverFetch));
    const response = await worker.fetch(validRequest(), {
      HELIUS_API_KEY: "test-api-key",
      SGT_RATE_LIMITER: { limit: async () => ({ success: false }) },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      status: "unable",
      code: "RATE_LIMITED",
    });
  });

  it("does not expose the API key, wallet address, mint, or RPC response in safe logs", async () => {
    const logs: SafeLogEvent[] = [];
    const secret = "do-not-leak-this-helius-key";
    const worker = createWorker(makeDependencies(genuineSgtFetch, logs));
    const response = await worker.fetch(validRequest(), env(secret));
    const responseText = await response.text();
    const logText = JSON.stringify(logs);

    expect(responseText).not.toContain(secret);
    expect(responseText).not.toContain(WALLET_ADDRESS);
    for (const sensitiveValue of [
      secret,
      WALLET_ADDRESS,
      FIRST_MINT_ADDRESS,
      "getMultipleAccounts",
    ]) {
      expect(logText).not.toContain(sensitiveValue);
    }
  });

  it("fails safely when the Worker secret is missing", async () => {
    const worker = createWorker(makeDependencies(neverFetch));
    const response = await worker.fetch(validRequest(), {});

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "unable",
      code: "SERVER_CONFIGURATION_ERROR",
    });
  });
});

function validRequest(): Request {
  return new Request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.10",
    },
    body: JSON.stringify({ walletAddress: WALLET_ADDRESS }),
  });
}

function env(apiKey = "test-api-key"): Env {
  return {
    HELIUS_API_KEY: apiKey,
    SGT_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
}

async function noSgtFetch(_url: string, init?: RequestInit): Promise<Response> {
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  if (body.method === "getSlot") {
    return rpcResponse(body, 123);
  }
  if (body.method === "getTokenAccountsByOwnerV2") {
    return rpcResponse(body, { value: [], paginationKey: null });
  }
  throw new Error(`Unexpected test RPC method: ${String(body.method)}`);
}

async function genuineSgtFetch(
  _url: string,
  init?: RequestInit,
): Promise<Response> {
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  if (body.method === "getSlot") {
    return rpcResponse(body, 123);
  }
  if (body.method === "getTokenAccountsByOwnerV2") {
    return rpcResponse(body, { value: [tokenAccount()], paginationKey: null });
  }
  if (body.method === "getMultipleAccounts") {
    const encodedMint = toBase64(mintAccount().data);
    return rpcResponse(body, {
      context: { slot: 123 },
      value: [{ owner: mintAccount().owner, data: [encodedMint, "base64"] }],
    });
  }
  throw new Error(`Unexpected test RPC method: ${String(body.method)}`);
}

async function neverFetch(): Promise<Response> {
  throw new Error("RPC must not be called in this test");
}
