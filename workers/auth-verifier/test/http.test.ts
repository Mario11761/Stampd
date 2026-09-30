import { describe, expect, it } from "vitest";
import { createWorker } from "../src/index";
import {
  SIWS_CHAIN_ID,
  SIWS_DOMAIN,
  SIWS_STATEMENT,
  SIWS_URI,
} from "../src/constants";
import type { Env } from "../src/types";
import {
  FIXED_NOW,
  WALLET_ADDRESS,
  challengeRequest,
  createTestContext,
  responseJson,
} from "./helpers";

function challengeFrom(body: Record<string, unknown>) {
  return body.challenge as Record<string, unknown>;
}

describe("POST /v1/siws/challenge", () => {
  it("returns and persists a valid server-generated challenge", async () => {
    const context = createTestContext();
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest(),
      context.env,
    );
    const body = await responseJson(response);
    const challenge = challengeFrom(body);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({ schemaVersion: 1, status: "issued" });
    expect(challenge).toMatchObject({
      address: WALLET_ADDRESS,
      domain: SIWS_DOMAIN,
      uri: SIWS_URI,
      chainId: SIWS_CHAIN_ID,
      statement: SIWS_STATEMENT,
    });
    expect(challenge).not.toHaveProperty("status");
    expect(challenge).not.toHaveProperty("durableObjectId");

    const storage = context.namespace.storageByName.get(
      String(challenge.requestId),
    );
    expect(storage).toBeDefined();
    expect(storage?.values.get("challenge")).toMatchObject({
      requestId: challenge.requestId,
      address: WALLET_ADDRESS,
      status: "issued",
    });
  });

  it("returns a 32-character lowercase hexadecimal nonce", async () => {
    const context = createTestContext();
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest(),
      context.env,
    );
    const challenge = challengeFrom(await responseJson(response));

    expect(challenge.nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it("issues different nonce and requestId values for every attempt", async () => {
    const context = createTestContext();
    const worker = createWorker(context.dependencies);
    const first = challengeFrom(
      await responseJson(await worker.fetch(challengeRequest(), context.env)),
    );
    const second = challengeFrom(
      await responseJson(await worker.fetch(challengeRequest(), context.env)),
    );

    expect(second.nonce).not.toBe(first.nonce);
    expect(second.requestId).not.toBe(first.requestId);
  });

  it("uses an exact five-minute server TTL", async () => {
    const context = createTestContext();
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest(),
      context.env,
    );
    const challenge = challengeFrom(await responseJson(response));

    expect(challenge.issuedAt).toBe(FIXED_NOW.toISOString());
    expect(
      Date.parse(String(challenge.expirationTime)) -
        Date.parse(String(challenge.issuedAt)),
    ).toBe(300_000);
  });

  it.each([
    [
      "client nonce",
      { walletAddress: WALLET_ADDRESS, nonce: "client-controlled" },
    ],
    ["unknown property", { walletAddress: WALLET_ADDRESS, extra: true }],
  ])("rejects a %s", async (_label, requestBody) => {
    const context = createTestContext();
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest(requestBody),
      context.env,
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      status: "unable",
      code: "INVALID_REQUEST",
    });
  });

  it("rejects a malformed wallet address", async () => {
    const context = createTestContext();
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest({ walletAddress: "not-a-solana-address" }),
      context.env,
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "INVALID_WALLET_ADDRESS",
    });
  });

  it("rejects an oversized request body", async () => {
    const context = createTestContext();
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest({ walletAddress: "1".repeat(300) }),
      context.env,
    );

    expect(response.status).toBe(413);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("rejects methods other than POST", async () => {
    const context = createTestContext();
    const request = new Request(
      "https://auth.stampdpass.com/v1/siws/challenge",
      { method: "GET" },
    );
    const response = await createWorker(context.dependencies).fetch(
      request,
      context.env,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "METHOD_NOT_ALLOWED",
    });
  });

  it("rejects non-JSON content types", async () => {
    const context = createTestContext();
    const request = new Request(
      "https://auth.stampdpass.com/v1/siws/challenge",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ walletAddress: WALLET_ADDRESS }),
      },
    );
    const response = await createWorker(context.dependencies).fetch(
      request,
      context.env,
    );

    expect(response.status).toBe(415);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "INVALID_CONTENT_TYPE",
    });
  });

  it("fails closed when challenge issuance is rate limited", async () => {
    const context = createTestContext({ rateLimitSuccess: false });
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest(),
      context.env,
    );

    expect(response.status).toBe(429);
    await expect(responseJson(response)).resolves.toEqual({
      schemaVersion: 1,
      status: "unable",
      code: "RATE_LIMITED",
      retryable: true,
    });
    expect(context.namespace.storageByName.size).toBe(0);
  });

  it("never logs the wallet address, nonce, body, or challenge message", async () => {
    const context = createTestContext();
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest(),
      context.env,
    );
    const challenge = challengeFrom(await responseJson(response));
    const serializedLogs = JSON.stringify(context.logs);

    expect(serializedLogs).not.toContain(WALLET_ADDRESS);
    expect(serializedLogs).not.toContain(String(challenge.nonce));
    expect(serializedLogs).not.toContain(SIWS_STATEMENT);
    expect(serializedLogs).not.toContain("walletAddress");
    expect(serializedLogs).toContain("CHALLENGE_ISSUED");
  });

  it("fails closed when required bindings are missing", async () => {
    const context = createTestContext();
    const response = await createWorker(context.dependencies).fetch(
      challengeRequest(),
      {} as Env,
    );

    expect(response.status).toBe(503);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "SERVER_CONFIGURATION_ERROR",
      status: "unable",
    });
  });
});
