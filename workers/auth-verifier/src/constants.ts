export const CHALLENGE_ENDPOINT_PATH = "/v1/siws/challenge";
export const VERIFY_ENDPOINT_PATH = "/v1/siws/verify";
export const CHALLENGE_TTL_MS = 5 * 60 * 1_000;
export const WALLET_CONTROL_PROOF_TTL_MS = 5 * 60 * 1_000;
export const CHALLENGE_RETENTION_MS = 60 * 60 * 1_000;
export const REQUEST_BODY_LIMIT_BYTES = 256;
export const VERIFY_REQUEST_BODY_LIMIT_BYTES = 2_048;
export const SIGNED_MESSAGE_LIMIT_BYTES = 1_024;
export const ED25519_SIGNATURE_BYTES = 64;
export const RANDOM_IDENTIFIER_BYTES = 16;
export const RANDOM_IDENTIFIER_HEX_LENGTH = RANDOM_IDENTIFIER_BYTES * 2;

export const SIWS_DOMAIN = "identity.stampdpass.com";
export const SIWS_URI = "https://identity.stampdpass.com";
export const SIWS_STATEMENT =
  "Sign in to Stampd to verify control of this wallet for Seeker status.";
export const SIWS_VERSION = "1";
export const SIWS_CHAIN_ID = "solana:mainnet";
