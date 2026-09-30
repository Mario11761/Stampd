import { ed25519 } from "@noble/curves/ed25519";
import { describe, expect, it } from "vitest";
import { createWorker } from "../src/index";
import { createCanonicalSiwsMessage } from "../src/siws";
import { encodeSolanaAddress } from "../src/solanaAddress";
import type { StoredChallenge } from "../src/types";
import {
  FIXED_NOW,
  challengeRequest,
  createTestContext,
  responseJson,
} from "./helpers";

const TEST_PRIVATE_KEY = new Uint8Array(32).fill(7);
const OTHER_TEST_PRIVATE_KEY = new Uint8Array(32).fill(19);
const TEST_ADDRESS = encodeSolanaAddress(
  ed25519.getPublicKey(TEST_PRIVATE_KEY),
);
const OTHER_TEST_ADDRESS = encodeSolanaAddress(
  ed25519.getPublicKey(OTHER_TEST_PRIVATE_KEY),
);

type TestContext = ReturnType<typeof createTestContext>;
type VerifyBody = {
  requestId: string;
  address: string;
  signedMessage: string;
  signature: string;
  signatureType: string;
  [key: string]: unknown;
};

async function issueFixture(context = createTestContext()) {
  const worker = createWorker(context.dependencies);
  const issueResponse = await worker.fetch(
    challengeRequest({ walletAddress: TEST_ADDRESS }),
    context.env,
  );
  const issueBody = await responseJson(issueResponse);
  const publicChallenge = issueBody.challenge as Record<string, unknown>;
  const requestId = String(publicChallenge.requestId);
  const storage = context.namespace.storageByName.get(requestId);
  const challenge = storage?.values.get("challenge") as
    | StoredChallenge
    | undefined;
  if (issueResponse.status !== 201 || challenge === undefined) {
    throw new Error("test challenge issuance failed");
  }

  const message = createCanonicalSiwsMessage(challenge);
  return {
    body: createVerifyBody(challenge, message),
    challenge,
    context,
    message,
    worker,
  };
}

function createVerifyBody(
  challenge: StoredChallenge,
  message: Uint8Array,
  privateKey: Uint8Array = TEST_PRIVATE_KEY,
): VerifyBody {
  return {
    requestId: challenge.requestId,
    address: challenge.address,
    signedMessage: toBase64(message),
    signature: toBase64(ed25519.sign(message, privateKey)),
    signatureType: "ed25519",
  };
}

function verifyRequest(
  body: unknown,
  options: { contentType?: string; method?: string } = {},
): Request {
  const method = options.method ?? "POST";
  return new Request("https://auth.stampdpass.com/v1/siws/verify", {
    method,
    headers: {
      "CF-Connecting-IP": "192.0.2.2",
      "Content-Type": options.contentType ?? "application/json",
    },
    body:
      method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body),
  });
}

async function submit(
  context: TestContext,
  worker: ReturnType<typeof createWorker>,
  body: unknown,
) {
  return worker.fetch(verifyRequest(body), context.env);
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function modifiedMessage(
  challenge: StoredChallenge,
  changes: Partial<StoredChallenge>,
): Uint8Array {
  return createCanonicalSiwsMessage({ ...challenge, ...changes });
}

describe("POST /v1/siws/verify", () => {
  it("verifies a valid challenge and Ed25519 signature", async () => {
    const fixture = await issueFixture();
    const response = await submit(
      fixture.context,
      fixture.worker,
      fixture.body,
    );
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      schemaVersion: 1,
      status: "wallet_control_verified",
      address: TEST_ADDRESS,
      verifiedAt: FIXED_NOW.toISOString(),
      proofExpiresAt: new Date(FIXED_NOW.getTime() + 300_000).toISOString(),
    });
  });

  it("rejects a signature made by the wrong private test key", async () => {
    const fixture = await issueFixture();
    const body = createVerifyBody(
      fixture.challenge,
      fixture.message,
      OTHER_TEST_PRIVATE_KEY,
    );
    const response = await submit(fixture.context, fixture.worker, body);

    expect(response.status).toBe(401);
    await expect(responseJson(response)).resolves.toMatchObject({
      status: "unable",
      code: "SIGNATURE_INVALID",
    });
  });

  it("rejects a correct signature paired with a different valid address", async () => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      address: OTHER_TEST_ADDRESS,
    });

    expect(response.status).toBe(401);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "SIGNATURE_INVALID",
    });
  });

  it("rejects any byte modification to the signed message", async () => {
    const fixture = await issueFixture();
    const message = new Uint8Array([...fixture.message, 10]);
    const response = await submit(
      fixture.context,
      fixture.worker,
      createVerifyBody(fixture.challenge, message),
    );

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "MESSAGE_MISMATCH",
    });
  });

  it.each([
    ["domain", { domain: "attacker.example" }],
    ["URI", { uri: "https://attacker.example" }],
    ["statement", { statement: "Approve something else." }],
    ["chainId", { chainId: "solana:devnet" }],
    ["nonce", { nonce: "f".repeat(32) }],
    ["issuedAt", { issuedAt: "2026-09-19T12:00:01.000Z" }],
    ["expirationTime", { expirationTime: "2026-09-19T12:06:00.000Z" }],
    ["requestId", { requestId: "f".repeat(32) }],
  ])("rejects a signed message with modified %s", async (_name, changes) => {
    const fixture = await issueFixture();
    const message = modifiedMessage(fixture.challenge, changes);
    const response = await submit(fixture.context, fixture.worker, {
      ...createVerifyBody(fixture.challenge, message),
      requestId: fixture.challenge.requestId,
    });

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      status: "unable",
      code: "MESSAGE_MISMATCH",
    });
  });

  it("rejects an expired challenge without consuming it", async () => {
    let now = new Date(FIXED_NOW);
    const context = createTestContext({ now: () => new Date(now) });
    const fixture = await issueFixture(context);
    now = new Date(Date.parse(fixture.challenge.expirationTime) + 1);
    const response = await submit(context, fixture.worker, fixture.body);

    expect(response.status).toBe(410);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "CHALLENGE_EXPIRED",
    });
    expect(
      context.namespace.storageByName
        .get(fixture.challenge.requestId)
        ?.values.get("challenge"),
    ).toMatchObject({ status: "expired" });
  });

  it("rejects an unknown challenge", async () => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      requestId: "f".repeat(32),
    });

    expect(response.status).toBe(404);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "CHALLENGE_NOT_FOUND",
    });
  });

  it("rejects a challenge already consumed before verification", async () => {
    const fixture = await issueFixture();
    const id = fixture.context.env.SIWS_CHALLENGES.idFromName(
      fixture.challenge.requestId,
    );
    await fixture.context.env.SIWS_CHALLENGES.get(id).consume(
      FIXED_NOW.toISOString(),
    );
    const response = await submit(
      fixture.context,
      fixture.worker,
      fixture.body,
    );

    expect(response.status).toBe(409);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "CHALLENGE_ALREADY_USED",
    });
  });

  it("rejects replay of a successfully verified signature", async () => {
    const fixture = await issueFixture();
    const first = await submit(fixture.context, fixture.worker, fixture.body);
    const replay = await submit(fixture.context, fixture.worker, fixture.body);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(409);
    await expect(responseJson(replay)).resolves.toMatchObject({
      status: "unable",
      code: "CHALLENGE_ALREADY_USED",
    });
  });

  it("allows exactly one of two concurrent valid verifiers to consume", async () => {
    const fixture = await issueFixture();
    const responses = await Promise.all([
      submit(fixture.context, fixture.worker, fixture.body),
      submit(fixture.context, fixture.worker, fixture.body),
    ]);

    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(1);
    expect(
      responses.filter((response) => response.status === 409),
    ).toHaveLength(1);
  });

  it("rejects malformed base64", async () => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      signedMessage: "not***base64",
    });

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "INVALID_ENCODING",
    });
  });

  it("rejects a signature that is not exactly 64 bytes", async () => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      signature: toBase64(new Uint8Array(63)),
    });

    expect(response.status).toBe(401);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "SIGNATURE_INVALID",
    });
  });

  it("rejects an address that does not decode to 32 bytes", async () => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      address: "1".repeat(31),
    });

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "INVALID_WALLET_ADDRESS",
    });
  });

  it("rejects an unsupported signature type", async () => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      signatureType: "secp256k1",
    });

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "SIGNATURE_TYPE_UNSUPPORTED",
    });
  });

  it("rejects extra request fields", async () => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      verified: true,
    });

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("rejects an oversized request", async () => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      signedMessage: "A".repeat(3_000),
    });

    expect(response.status).toBe(413);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("rejects methods other than POST", async () => {
    const context = createTestContext();
    const worker = createWorker(context.dependencies);
    const response = await worker.fetch(
      verifyRequest({}, { method: "GET" }),
      context.env,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "METHOD_NOT_ALLOWED",
    });
  });

  it("rejects non-JSON content types", async () => {
    const fixture = await issueFixture();
    const response = await fixture.worker.fetch(
      verifyRequest(fixture.body, { contentType: "text/plain" }),
      fixture.context.env,
    );

    expect(response.status).toBe(415);
    await expect(responseJson(response)).resolves.toMatchObject({
      code: "INVALID_CONTENT_TYPE",
    });
  });

  it("fails closed on Durable Object lookup errors", async () => {
    const fixture = await issueFixture();
    fixture.context.namespace.failLookupStorage = true;
    const response = await submit(
      fixture.context,
      fixture.worker,
      fixture.body,
    );

    expect(response.status).toBe(503);
    await expect(responseJson(response)).resolves.toEqual({
      schemaVersion: 1,
      status: "unable",
      code: "VERIFICATION_STORAGE_ERROR",
      retryable: true,
    });
  });

  it("fails closed when atomic consumption errors after valid verification", async () => {
    const fixture = await issueFixture();
    fixture.context.namespace.failConsumeStorage = true;
    const response = await submit(
      fixture.context,
      fixture.worker,
      fixture.body,
    );

    expect(response.status).toBe(503);
    await expect(responseJson(response)).resolves.toEqual({
      schemaVersion: 1,
      status: "unable",
      code: "VERIFICATION_STORAGE_ERROR",
      retryable: true,
    });
  });

  it.each([
    ["malformed message", { signedMessage: "***" }],
    ["unsupported scheme", { signatureType: "rsa" }],
    ["client success claim", { verified: true }],
  ])("never turns %s into verification success", async (_name, change) => {
    const fixture = await issueFixture();
    const response = await submit(fixture.context, fixture.worker, {
      ...fixture.body,
      ...change,
    });
    const body = await responseJson(response);

    expect(response.status).not.toBe(200);
    expect(body.status).toBe("unable");
  });

  it("never emits Verified Seeker", async () => {
    const fixture = await issueFixture();
    const response = await submit(
      fixture.context,
      fixture.worker,
      fixture.body,
    );

    expect(JSON.stringify(await responseJson(response))).not.toContain(
      "Verified Seeker",
    );
  });

  it("issues no auth token, cookie, JWT, or bearer session", async () => {
    const fixture = await issueFixture();
    const response = await submit(
      fixture.context,
      fixture.worker,
      fixture.body,
    );
    const body = await responseJson(response);

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(body).not.toHaveProperty("token");
    expect(body).not.toHaveProperty("authToken");
    expect(body).not.toHaveProperty("session");
  });

  it("never logs wallet, challenge, message, signature, or raw request values", async () => {
    const fixture = await issueFixture();
    await submit(fixture.context, fixture.worker, fixture.body);
    const logs = JSON.stringify(fixture.context.logs);
    const messageText = new TextDecoder().decode(fixture.message);

    expect(logs).not.toContain(TEST_ADDRESS);
    expect(logs).not.toContain(fixture.challenge.requestId);
    expect(logs).not.toContain(fixture.challenge.nonce);
    expect(logs).not.toContain(messageText);
    expect(logs).not.toContain(fixture.body.signedMessage);
    expect(logs).not.toContain(fixture.body.signature);
    expect(logs).toContain("WALLET_CONTROL_VERIFIED");
  });

  it("fails closed when verification is rate limited", async () => {
    const fixture = await issueFixture();
    fixture.context.rateLimiter.success = false;
    const response = await submit(
      fixture.context,
      fixture.worker,
      fixture.body,
    );

    expect(response.status).toBe(429);
    await expect(responseJson(response)).resolves.toMatchObject({
      status: "unable",
      code: "RATE_LIMITED",
    });
  });
});
