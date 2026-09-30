import type { SiwsChallengeObject } from "./durableObject";
import type { SolanaAddress } from "./solanaAddress";

export type ChallengeStatus = "issued" | "consumed" | "expired";

export type SiwsChallenge = Readonly<{
  domain: string;
  address: SolanaAddress;
  statement: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  requestId: string;
}>;

export type StoredChallenge = SiwsChallenge &
  Readonly<{
    status: ChallengeStatus;
  }>;

export type ConsumeResult =
  | "consumed"
  | "already_consumed"
  | "expired"
  | "not_found";

export type ChallengeLookupResult =
  | Readonly<{ status: "issued"; challenge: StoredChallenge }>
  | Readonly<{
      status: "not_found" | "expired" | "already_consumed";
    }>;

export type ChallengeResponse = Readonly<{
  schemaVersion: 1;
  status: "issued";
  challenge: SiwsChallenge;
}>;

export type UnableResponse = Readonly<{
  schemaVersion: 1;
  status: "unable";
  code: string;
  retryable: boolean;
}>;

export type VerifyRequest = Readonly<{
  requestId: string;
  address: SolanaAddress;
  signedMessage: Uint8Array;
  signature: Uint8Array;
  signatureType: "ed25519";
}>;

export type WalletControlVerifiedResponse = Readonly<{
  schemaVersion: 1;
  status: "wallet_control_verified";
  address: SolanaAddress;
  verifiedAt: string;
  proofExpiresAt: string;
}>;

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  SIWS_CHALLENGES: DurableObjectNamespace<SiwsChallengeObject>;
  SIWS_RATE_LIMITER: RateLimiter;
}

export type SafeLogEvent = Readonly<{
  correlationId?: string;
  httpStatus: number;
  code: string;
  stage: "request" | "rate_limit" | "storage" | "verification" | "complete";
  durationMs: number;
}>;

export interface WorkerDependencies {
  now(): Date;
  randomBytes(length: number): Uint8Array;
  hashIdentifier(value: string): Promise<string>;
  log(event: SafeLogEvent): void;
}

export interface AtomicStorageView {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface ChallengeStorage extends AtomicStorageView {
  transaction<T>(
    callback: (transaction: AtomicStorageView) => Promise<T>,
  ): Promise<T>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAll(): Promise<void>;
}
