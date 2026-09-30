import {
  CHALLENGE_TTL_MS,
  RANDOM_IDENTIFIER_BYTES,
  SIWS_CHAIN_ID,
  SIWS_DOMAIN,
  SIWS_STATEMENT,
  SIWS_URI,
  SIWS_VERSION,
} from "./constants";
import { SafeError } from "./errors";
import type { SolanaAddress } from "./solanaAddress";
import type { SiwsChallenge, StoredChallenge } from "./types";

export function createChallenge(
  walletAddress: SolanaAddress,
  now: Date,
  randomBytes: (length: number) => Uint8Array,
): StoredChallenge {
  if (!Number.isFinite(now.getTime())) {
    throw new SafeError("SERVER_CONFIGURATION_ERROR", 503, true, "storage");
  }

  const issuedAt = now.toISOString();
  const expirationTime = new Date(
    now.getTime() + CHALLENGE_TTL_MS,
  ).toISOString();
  const challenge: SiwsChallenge = Object.freeze({
    domain: SIWS_DOMAIN,
    address: walletAddress,
    statement: SIWS_STATEMENT,
    uri: SIWS_URI,
    version: SIWS_VERSION,
    chainId: SIWS_CHAIN_ID,
    nonce: randomHex(randomBytes, RANDOM_IDENTIFIER_BYTES),
    issuedAt,
    expirationTime,
    requestId: randomHex(randomBytes, RANDOM_IDENTIFIER_BYTES),
  });

  return Object.freeze({ ...challenge, status: "issued" });
}

export function publicChallenge(record: StoredChallenge): SiwsChallenge {
  const { status: _status, ...challenge } = record;
  return Object.freeze(challenge);
}

function randomHex(
  randomBytes: (length: number) => Uint8Array,
  length: number,
): string {
  const bytes = randomBytes(length);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== length) {
    throw new SafeError("SERVER_CONFIGURATION_ERROR", 503, true, "storage");
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
