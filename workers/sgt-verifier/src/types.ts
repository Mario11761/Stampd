import type { Address } from "@solana/kit";

export type DetectedResult = Readonly<{
  schemaVersion: 1;
  status: "detected";
  network: "solana:mainnet";
  sgtMintAddresses: string[];
  observedSlot: number;
  checkedAt: string;
}>;

export type NotDetectedResult = Readonly<{
  schemaVersion: 1;
  status: "not_detected";
  network: "solana:mainnet";
  sgtMintAddresses: [];
  observedSlot: number;
  checkedAt: string;
}>;

export type UnableResult = Readonly<{
  schemaVersion: 1;
  status: "unable";
  code: string;
  retryable: boolean;
  requestId: string;
}>;

export type SgtCheckResult = DetectedResult | NotDetectedResult | UnableResult;

export type TokenAccountPage = Readonly<{
  accounts: unknown[];
  paginationKey: string | null;
}>;

export type MintAccountValue = Readonly<{
  data: Uint8Array;
  owner: string;
}>;

export interface SgtRpcClient {
  getObservedSlot(signal: AbortSignal): Promise<number>;
  getTokenAccountPage(
    walletAddress: Address,
    paginationKey: string | undefined,
    minContextSlot: number,
    signal: AbortSignal,
  ): Promise<TokenAccountPage>;
  getMintAccounts(
    mintAddresses: readonly Address[],
    minContextSlot: number,
    signal: AbortSignal,
  ): Promise<(MintAccountValue | null)[]>;
}

export type VerificationStats = Readonly<{
  pageCount: number;
  candidateCount: number;
  checkedMintCount: number;
}>;

export type VerificationResult = Readonly<{
  status: "detected" | "not_detected";
  observedSlot: number;
  sgtMintAddresses: string[];
  stats: VerificationStats;
}>;

export type SafeLogEvent = Readonly<{
  requestId: string;
  outcome: "detected" | "not_detected" | "unable" | "rate_limited";
  durationMs: number;
  failureCategory?: string;
  pageCount?: number;
  candidateCount?: number;
}>;

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  HELIUS_API_KEY?: string;
  SGT_RATE_LIMITER?: RateLimiter;
}

export type WorkerDependencies = Readonly<{
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  now: () => Date;
  randomUUID: () => string;
  log: (event: SafeLogEvent) => void;
}>;
