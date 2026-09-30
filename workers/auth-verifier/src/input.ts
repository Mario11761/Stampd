import { REQUEST_BODY_LIMIT_BYTES } from "./constants";
import { SafeError } from "./errors";
import { parseSolanaAddress, type SolanaAddress } from "./solanaAddress";

export async function readWalletAddress(
  request: Request,
): Promise<SolanaAddress> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new SafeError("INVALID_CONTENT_TYPE", 415, false, "request");
  }

  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > REQUEST_BODY_LIMIT_BYTES)
  ) {
    throw new SafeError("INVALID_REQUEST", 413, false, "request");
  }

  const bytes = await readBodyBytes(request);
  if (bytes.byteLength === 0 || bytes.byteLength > REQUEST_BODY_LIMIT_BYTES) {
    throw new SafeError(
      "INVALID_REQUEST",
      bytes.byteLength > REQUEST_BODY_LIMIT_BYTES ? 413 : 400,
      false,
      "request",
    );
  }

  let body: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    body = JSON.parse(text);
  } catch {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }

  if (!isRecord(body)) {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "walletAddress") {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }

  const walletAddress = body.walletAddress;
  if (
    typeof walletAddress !== "string" ||
    walletAddress.length === 0 ||
    walletAddress !== walletAddress.trim()
  ) {
    throw new SafeError("INVALID_WALLET_ADDRESS", 400, false, "request");
  }

  try {
    return parseSolanaAddress(walletAddress);
  } catch {
    throw new SafeError("INVALID_WALLET_ADDRESS", 400, false, "request");
  }
}

async function readBodyBytes(request: Request): Promise<Uint8Array> {
  if (request.body === null) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > REQUEST_BODY_LIMIT_BYTES) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
