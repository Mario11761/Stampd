const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(
  Array.from(BASE58_ALPHABET, (character, index) => [character, index]),
);
const SOLANA_ADDRESS_BYTES = 32;

declare const solanaAddressBrand: unique symbol;

export type SolanaAddress = string & {
  readonly [solanaAddressBrand]: true;
};

export function parseSolanaAddress(value: string): SolanaAddress {
  decodeSolanaAddress(value);
  return value as SolanaAddress;
}

export function decodeSolanaAddress(value: string): Uint8Array {
  const bytes = decodeBase58(value);
  if (
    bytes.byteLength !== SOLANA_ADDRESS_BYTES ||
    encodeBase58(bytes) !== value
  ) {
    throw new Error("invalid Solana address");
  }
  return bytes;
}

export function encodeSolanaAddress(bytes: Uint8Array): SolanaAddress {
  if (bytes.byteLength !== SOLANA_ADDRESS_BYTES) {
    throw new Error("invalid Solana public key length");
  }
  return encodeBase58(bytes) as SolanaAddress;
}

function decodeBase58(value: string): Uint8Array {
  if (value.length === 0 || value.length > 44) {
    throw new Error("invalid base58 length");
  }

  let numericValue = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) {
      throw new Error("invalid base58 character");
    }
    numericValue = numericValue * 58n + BigInt(digit);
  }

  const significantBytes: number[] = [];
  while (numericValue > 0n) {
    significantBytes.unshift(Number(numericValue & 0xffn));
    numericValue >>= 8n;
  }

  let leadingZeroCount = 0;
  while (value[leadingZeroCount] === "1") {
    leadingZeroCount += 1;
  }

  const bytes = new Uint8Array(leadingZeroCount + significantBytes.length);
  bytes.set(significantBytes, leadingZeroCount);
  return bytes;
}

function encodeBase58(bytes: Uint8Array): string {
  let leadingZeroCount = 0;
  while (bytes[leadingZeroCount] === 0) {
    leadingZeroCount += 1;
  }

  let numericValue = 0n;
  for (const byte of bytes) {
    numericValue = (numericValue << 8n) + BigInt(byte);
  }

  let encoded = "";
  while (numericValue > 0n) {
    const remainder = Number(numericValue % 58n);
    encoded = BASE58_ALPHABET[remainder] + encoded;
    numericValue /= 58n;
  }

  return "1".repeat(leadingZeroCount) + encoded;
}
