import { ChallengeRepository } from "../src/storage";
import { parseSolanaAddress } from "../src/solanaAddress";
import type {
  AtomicStorageView,
  ChallengeStorage,
  Env,
  RateLimiter,
  SafeLogEvent,
  StoredChallenge,
  WorkerDependencies,
} from "../src/types";

export const WALLET_ADDRESS = parseSolanaAddress(
  "11111111111111111111111111111111",
);
export const FIXED_NOW = new Date("2026-09-19T12:00:00.000Z");

export class MemoryChallengeStorage implements ChallengeStorage {
  readonly values = new Map<string, unknown>();
  alarm: number | null = null;
  #transactionTail: Promise<void> = Promise.resolve();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value as T);
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async transaction<T>(
    callback: (transaction: AtomicStorageView) => Promise<T>,
  ): Promise<T> {
    const predecessor = this.#transactionTail;
    let release: () => void = () => {};
    this.#transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await predecessor;
    try {
      return await callback(this);
    } finally {
      release();
    }
  }

  async setAlarm(scheduledTime: number | Date): Promise<void> {
    this.alarm =
      scheduledTime instanceof Date ? scheduledTime.getTime() : scheduledTime;
  }

  async deleteAll(): Promise<void> {
    this.values.clear();
    this.alarm = null;
  }
}

class FakeChallengeNamespace {
  readonly storageByName = new Map<string, MemoryChallengeStorage>();
  failConsumeStorage = false;
  failLookupStorage = false;

  idFromName(name: string): DurableObjectId {
    return { name } as unknown as DurableObjectId;
  }

  get(id: DurableObjectId) {
    const name = (id as unknown as { name: string }).name;
    let storage = this.storageByName.get(name);
    if (storage === undefined) {
      storage = new MemoryChallengeStorage();
      this.storageByName.set(name, storage);
    }
    const repository = new ChallengeRepository(storage);
    return {
      initialize: (record: StoredChallenge) => repository.initialize(record),
      consume: (nowIso: string) => {
        if (this.failConsumeStorage) throw new Error("storage failure");
        return repository.consume(new Date(nowIso));
      },
      getForVerification: (nowIso: string) => {
        if (this.failLookupStorage) throw new Error("storage failure");
        return repository.getForVerification(new Date(nowIso));
      },
    };
  }
}

class FakeRateLimiter implements RateLimiter {
  readonly keys: string[] = [];

  constructor(public success: boolean) {}

  async limit(options: { key: string }): Promise<{ success: boolean }> {
    this.keys.push(options.key);
    return { success: this.success };
  }
}

export function createTestContext(
  options: {
    now?: () => Date;
    rateLimitSuccess?: boolean;
  } = {},
) {
  let randomCall = 0;
  const logs: SafeLogEvent[] = [];
  const namespace = new FakeChallengeNamespace();
  const rateLimiter = new FakeRateLimiter(options.rateLimitSuccess ?? true);
  const dependencies: WorkerDependencies = {
    now: options.now ?? (() => new Date(FIXED_NOW)),
    randomBytes: (length) => {
      randomCall += 1;
      return new Uint8Array(length).fill(randomCall);
    },
    hashIdentifier: async () => "a".repeat(64),
    log: (event) => logs.push(event),
  };
  const env = {
    SIWS_CHALLENGES: namespace,
    SIWS_RATE_LIMITER: rateLimiter,
  } as unknown as Env;

  return { dependencies, env, logs, namespace, rateLimiter };
}

export function challengeRequest(
  body: unknown = { walletAddress: WALLET_ADDRESS },
) {
  return new Request("https://auth.stampdpass.com/v1/siws/challenge", {
    method: "POST",
    headers: {
      "CF-Connecting-IP": "192.0.2.1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function responseJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}
