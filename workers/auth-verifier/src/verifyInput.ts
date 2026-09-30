import {
  ED25519_SIGNATURE_BYTES,
  RANDOM_IDENTIFIER_HEX_LENGTH,
  SIGNED_MESSAGE_LIMIT_BYTES,
  VERIFY_REQUEST_BODY_LIMIT_BYTES,
} from "./constants";
import { SafeError } from "./errors";
import { parseSolanaAddress } from "./solanaAddress";
import type { VerifyRequest } from "./types";

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SIGNED_MESSAGE_BASE64_LIMIT =
  4 * Math.ceil(SIGNED_MESSAGE_LIMIT_BYTES / 3);
const SIGNATURE_BASE64_LIMIT = 128;

export async function readVerifyRequest(
  request: Request,
): Promise<VerifyRequest> {
  assertJsonContentType(request);
  const bytes = await readBodyBytes(request, VERIFY_REQUEST_BODY_LIMIT_BYTES);
  if (bytes.byteLength === 0) {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }

  if (!isRecord(body)) {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }
  const expectedKeys = [
    "address",
    "requestId",
    "signature",
    "signatureType",
    "signedMessage",
  ];
  const actualKeys = Object.keys(body).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    !actualKeys.every((key, index) => key === expectedKeys[index])
  ) {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }

  if (
    typeof body.requestId !== "string" ||
    !new RegExp(`^[0-9a-f]{${RANDOM_IDENTIFIER_HEX_LENGTH}}$`).test(
      body.requestId,
    )
  ) {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }
  if (typeof body.address !== "string") {
    throw new SafeError("INVALID_WALLET_ADDRESS", 400, false, "request");
  }
  let address;
  try {
    address = parseSolanaAddress(body.address);
  } catch {
    throw new SafeError("INVALID_WALLET_ADDRESS", 400, false, "request");
  }

  if (body.signatureType !== "ed25519") {
    if (typeof body.signatureType === "string") {
      throw new SafeError("SIGNATURE_TYPE_UNSUPPORTED", 400, false, "request");
    }
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }
  if (
    typeof body.signedMessage !== "string" ||
    typeof body.signature !== "string"
  ) {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }
  if (
    body.signedMessage.length > SIGNED_MESSAGE_BASE64_LIMIT ||
    body.signature.length > SIGNATURE_BASE64_LIMIT
  ) {
    throw new SafeError("INVALID_REQUEST", 413, false, "request");
  }

  const signedMessage = decodeCanonicalBase64(body.signedMessage);
  const signature = decodeCanonicalBase64(body.signature);
  if (
    signedMessage.byteLength === 0 ||
    signedMessage.byteLength > SIGNED_MESSAGE_LIMIT_BYTES
  ) {
    throw new SafeError("INVALID_ENCODING", 400, false, "request");
  }
  if (signature.byteLength !== ED25519_SIGNATURE_BYTES) {
    throw new SafeError("SIGNATURE_INVALID", 401, false, "verification");
  }

  return {
    requestId: body.requestId,
    address,
    signedMessage,
    signature,
    signatureType: "ed25519",
  };
}

function assertJsonContentType(request: Request): void {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new SafeError("INVALID_CONTENT_TYPE", 415, false, "request");
  }
}

async function readBodyBytes(
  request: Request,
  limit: number,
): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > limit)
  ) {
    throw new SafeError("INVALID_REQUEST", 413, false, "request");
  }
  if (request.body === null) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > limit) {
        await reader.cancel().catch(() => undefined);
        throw new SafeError("INVALID_REQUEST", 413, false, "request");
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
  return bytes;
}

function decodeCanonicalBase64(value: string): Uint8Array {
  if (!BASE64_PATTERN.test(value)) {
    throw new SafeError("INVALID_ENCODING", 400, false, "request");
  }
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    if (encodeBase64(bytes) !== value) {
      throw new Error("non-canonical base64");
    }
    return bytes;
  } catch (error: unknown) {
    if (error instanceof SafeError) throw error;
    throw new SafeError("INVALID_ENCODING", 400, false, "request");
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
