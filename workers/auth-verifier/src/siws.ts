import { createSignInMessage } from "@solana/wallet-standard-util";
import { SafeError } from "./errors";
import { decodeSolanaAddress } from "./solanaAddress";
import type { StoredChallenge, VerifyRequest } from "./types";

export function createCanonicalSiwsMessage(
  challenge: StoredChallenge,
): Uint8Array {
  return createSignInMessage({
    domain: challenge.domain,
    address: challenge.address,
    statement: challenge.statement,
    uri: challenge.uri,
    version: challenge.version,
    chainId: challenge.chainId,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expirationTime: challenge.expirationTime,
    requestId: challenge.requestId,
  });
}

export async function verifyWalletControl(
  challenge: StoredChallenge,
  request: VerifyRequest,
): Promise<void> {
  if (request.address !== challenge.address) {
    throw new SafeError("SIGNATURE_INVALID", 401, false, "verification");
  }

  const expectedMessage = createCanonicalSiwsMessage(challenge);
  if (!bytesEqual(expectedMessage, request.signedMessage)) {
    throw new SafeError("MESSAGE_MISMATCH", 400, false, "verification");
  }

  const publicKey = decodeSolanaAddress(request.address);
  let valid = false;
  try {
    const verificationKey = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify(
      { name: "Ed25519" },
      verificationKey,
      toArrayBuffer(request.signature),
      toArrayBuffer(request.signedMessage),
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new SafeError("SIGNATURE_INVALID", 401, false, "verification");
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesEqual(first: Uint8Array, second: Uint8Array): boolean {
  if (first.byteLength !== second.byteLength) return false;
  for (let index = 0; index < first.byteLength; index += 1) {
    if (first[index] !== second[index]) return false;
  }
  return true;
}
