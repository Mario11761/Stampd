import {
  CHALLENGE_RETENTION_MS,
  CHALLENGE_TTL_MS,
  RANDOM_IDENTIFIER_HEX_LENGTH,
  SIWS_CHAIN_ID,
  SIWS_DOMAIN,
  SIWS_STATEMENT,
  SIWS_URI,
  SIWS_VERSION,
} from "./constants";
import { SafeError } from "./errors";
import { parseSolanaAddress } from "./solanaAddress";
import type { ChallengeStorage, ConsumeResult, StoredChallenge } from "./types";
import type { ChallengeLookupResult } from "./types";

const CHALLENGE_KEY = "challenge";

export class ChallengeRepository {
  constructor(private readonly storage: ChallengeStorage) {}

  async initialize(record: StoredChallenge): Promise<boolean> {
    assertStoredChallenge(record);
    const created = await this.storage.transaction(async (transaction) => {
      const existing = await transaction.get<unknown>(CHALLENGE_KEY);
      if (existing !== undefined) {
        return false;
      }
      await transaction.put(CHALLENGE_KEY, record);
      return true;
    });

    if (created) {
      await this.storage.setAlarm(Date.parse(record.expirationTime));
    }
    return created;
  }

  async consume(now: Date): Promise<ConsumeResult> {
    assertValidDate(now);
    return this.storage.transaction(async (transaction) => {
      const record = await readRecord(transaction);
      if (record === null) {
        return "not_found";
      }
      if (record.status === "consumed") {
        return "already_consumed";
      }
      if (
        record.status === "expired" ||
        now.getTime() >= Date.parse(record.expirationTime)
      ) {
        if (record.status === "issued") {
          await transaction.put(CHALLENGE_KEY, {
            ...record,
            status: "expired",
          } satisfies StoredChallenge);
        }
        return "expired";
      }

      await transaction.put(CHALLENGE_KEY, {
        ...record,
        status: "consumed",
      } satisfies StoredChallenge);
      return "consumed";
    });
  }

  async getForVerification(now: Date): Promise<ChallengeLookupResult> {
    assertValidDate(now);
    return this.storage.transaction(async (transaction) => {
      const record = await readRecord(transaction);
      if (record === null) {
        return { status: "not_found" };
      }
      if (record.status === "consumed") {
        return { status: "already_consumed" };
      }
      if (
        record.status === "expired" ||
        now.getTime() >= Date.parse(record.expirationTime)
      ) {
        if (record.status === "issued") {
          await transaction.put(CHALLENGE_KEY, {
            ...record,
            status: "expired",
          } satisfies StoredChallenge);
        }
        return { status: "expired" };
      }
      return { status: "issued", challenge: record };
    });
  }

  async expire(now: Date): Promise<StoredChallenge | null> {
    assertValidDate(now);
    return this.storage.transaction(async (transaction) => {
      const record = await readRecord(transaction);
      if (record === null) {
        return null;
      }
      if (
        record.status === "issued" &&
        now.getTime() >= Date.parse(record.expirationTime)
      ) {
        const expired = {
          ...record,
          status: "expired",
        } satisfies StoredChallenge;
        await transaction.put(CHALLENGE_KEY, expired);
        return expired;
      }
      return record;
    });
  }

  async scheduleCleanup(record: StoredChallenge): Promise<void> {
    await this.storage.setAlarm(
      Date.parse(record.expirationTime) + CHALLENGE_RETENTION_MS,
    );
  }

  async deleteAll(): Promise<void> {
    await this.storage.deleteAll();
  }

  async get(): Promise<StoredChallenge | null> {
    return readRecord(this.storage);
  }
}

async function readRecord(
  storage: Pick<ChallengeStorage, "get">,
): Promise<StoredChallenge | null> {
  const value = await storage.get<unknown>(CHALLENGE_KEY);
  if (value === undefined) {
    return null;
  }
  assertStoredChallenge(value);
  return value;
}

function assertStoredChallenge(
  value: unknown,
): asserts value is StoredChallenge {
  if (!isRecord(value)) {
    throw storageError();
  }
  const expectedKeys = [
    "address",
    "chainId",
    "domain",
    "expirationTime",
    "issuedAt",
    "nonce",
    "requestId",
    "statement",
    "status",
    "uri",
    "version",
  ];
  const actualKeys = Object.keys(value).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    !actualKeys.every((key, index) => key === expectedKeys[index]) ||
    typeof value.address !== "string" ||
    value.domain !== SIWS_DOMAIN ||
    value.uri !== SIWS_URI ||
    value.statement !== SIWS_STATEMENT ||
    value.version !== SIWS_VERSION ||
    value.chainId !== SIWS_CHAIN_ID ||
    typeof value.nonce !== "string" ||
    !new RegExp(`^[0-9a-f]{${RANDOM_IDENTIFIER_HEX_LENGTH}}$`).test(
      value.nonce,
    ) ||
    typeof value.requestId !== "string" ||
    !new RegExp(`^[0-9a-f]{${RANDOM_IDENTIFIER_HEX_LENGTH}}$`).test(
      value.requestId,
    ) ||
    typeof value.issuedAt !== "string" ||
    typeof value.expirationTime !== "string" ||
    !Number.isFinite(Date.parse(value.issuedAt)) ||
    !Number.isFinite(Date.parse(value.expirationTime)) ||
    !["issued", "consumed", "expired"].includes(String(value.status))
  ) {
    throw storageError();
  }

  try {
    parseSolanaAddress(value.address);
  } catch {
    throw storageError();
  }

  const issuedAtMs = Date.parse(value.issuedAt);
  const expirationTimeMs = Date.parse(value.expirationTime);
  if (
    new Date(issuedAtMs).toISOString() !== value.issuedAt ||
    new Date(expirationTimeMs).toISOString() !== value.expirationTime ||
    expirationTimeMs - issuedAtMs !== CHALLENGE_TTL_MS
  ) {
    throw storageError();
  }
}

function assertValidDate(value: Date): void {
  if (!Number.isFinite(value.getTime())) {
    throw storageError();
  }
}

function storageError(): SafeError {
  return new SafeError("CHALLENGE_STORAGE_ERROR", 503, true, "storage");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
