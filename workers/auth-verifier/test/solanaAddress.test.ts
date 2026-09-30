import { describe, expect, it } from "vitest";
import { parseSolanaAddress } from "../src/solanaAddress";

describe("Solana address validation", () => {
  it("accepts a canonical 32-byte base58 public key", () => {
    const value = "So11111111111111111111111111111111111111112";

    expect(parseSolanaAddress(value)).toBe(value);
  });

  it("rejects non-base58 characters", () => {
    expect(() => parseSolanaAddress("0".repeat(32))).toThrow();
  });

  it("rejects non-32-byte and non-canonical representations", () => {
    expect(() => parseSolanaAddress("1".repeat(31))).toThrow();
    expect(() => parseSolanaAddress("1".repeat(33))).toThrow();
  });
});
