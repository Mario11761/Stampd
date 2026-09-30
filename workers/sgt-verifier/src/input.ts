import { address, type Address } from "@solana/kit";
import { REQUEST_BODY_LIMIT_BYTES } from "./constants";
import { SafeError } from "./errors";

export async function readWalletAddress(request: Request): Promise<Address> {
  const contentType = request.headers.get("content-type");
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();

  if (mediaType !== "application/json") {
    throw new SafeError("UNSUPPORTED_CONTENT_TYPE", 415, false, "request");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (
      !/^\d+$/.test(contentLength) ||
      Number(contentLength) > REQUEST_BODY_LIMIT_BYTES
    ) {
      throw new SafeError("REQUEST_TOO_LARGE", 413, false, "request");
    }
  }

  const bytes = await readBodyBytes(request);
  if (bytes.byteLength === 0) {
    throw new SafeError("EMPTY_REQUEST", 400, false, "request");
  }
  if (bytes.byteLength > REQUEST_BODY_LIMIT_BYTES) {
    throw new SafeError("REQUEST_TOO_LARGE", 413, false, "request");
  }

  let bodyText: string;
  try {
    bodyText = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
  } catch {
    throw new SafeError("MALFORMED_JSON", 400, false, "request");
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new SafeError("MALFORMED_JSON", 400, false, "request");
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
    return address(walletAddress);
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
        throw new SafeError("REQUEST_TOO_LARGE", 413, false, "request");
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
