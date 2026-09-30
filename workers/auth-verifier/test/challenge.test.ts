import { describe, expect, it } from "vitest";
import {
  CHALLENGE_TTL_MS,
  SIWS_CHAIN_ID,
  SIWS_DOMAIN,
  SIWS_STATEMENT,
  SIWS_URI,
  SIWS_VERSION,
} from "../src/constants";
import { createChallenge, publicChallenge } from "../src/challenge";
import { FIXED_NOW, WALLET_ADDRESS } from "./helpers";

describe("createChallenge", () => {
  it("creates the exact server-controlled immutable SIWS fields", () => {
    let byte = 0;
    const record = createChallenge(WALLET_ADDRESS, FIXED_NOW, (length) =>
      new Uint8Array(length).fill(++byte),
    );

    expect(record).toMatchObject({
      domain: SIWS_DOMAIN,
      address: WALLET_ADDRESS,
      statement: SIWS_STATEMENT,
      uri: SIWS_URI,
      version: SIWS_VERSION,
      chainId: SIWS_CHAIN_ID,
      status: "issued",
    });
    expect(Object.isFrozen(record)).toBe(true);
  });

  it("uses independent 128-bit lowercase hexadecimal identifiers", () => {
    let byte = 0;
    const record = createChallenge(WALLET_ADDRESS, FIXED_NOW, (length) =>
      new Uint8Array(length).fill(++byte),
    );

    expect(record.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(record.requestId).toMatch(/^[0-9a-f]{32}$/);
    expect(record.nonce).not.toBe(record.requestId);
  });

  it("expires exactly five minutes after server issuance", () => {
    const record = createChallenge(WALLET_ADDRESS, FIXED_NOW, (length) =>
      new Uint8Array(length).fill(1),
    );

    expect(
      Date.parse(record.expirationTime) - Date.parse(record.issuedAt),
    ).toBe(CHALLENGE_TTL_MS);
  });

  it("never exposes Durable Object status in the public challenge", () => {
    const record = createChallenge(WALLET_ADDRESS, FIXED_NOW, (length) =>
      new Uint8Array(length).fill(1),
    );

    expect(publicChallenge(record)).not.toHaveProperty("status");
  });
});
