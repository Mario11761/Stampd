import { address } from "@solana/kit";
import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";

export const TOKEN_2022_PROGRAM_ID = address(TOKEN_2022_PROGRAM_ADDRESS);
export const SGT_MINT_AUTHORITY = address(
  "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4",
);
export const SGT_METADATA_ADDRESS = address(
  "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te",
);
export const SGT_GROUP_ADDRESS = address(
  "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te",
);

export const SGT_ENDPOINT_PATH = "/v1/sgt/check";
export const HELIUS_MAINNET_RPC_ORIGIN = "https://mainnet.helius-rpc.com/";
export const NETWORK = "solana:mainnet" as const;
export const REQUEST_BODY_LIMIT_BYTES = 256;
export const RPC_RESPONSE_LIMIT_CHARACTERS = 16 * 1024 * 1024;
export const RPC_TIMEOUT_MS = 5_000;
export const OVERALL_TIMEOUT_MS = 12_000;
export const TOKEN_ACCOUNT_PAGE_SIZE = 1_000;
export const MAX_TOKEN_ACCOUNT_PAGES = 20;
export const MINT_BATCH_SIZE = 100;
