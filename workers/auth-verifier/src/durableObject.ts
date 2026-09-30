import { DurableObject } from "cloudflare:workers";
import { CHALLENGE_RETENTION_MS } from "./constants";
import { SafeError } from "./errors";
import { ChallengeRepository } from "./storage";
import type {
  ChallengeLookupResult,
  ChallengeStorage,
  ConsumeResult,
  Env,
  StoredChallenge,
} from "./types";

export class SiwsChallengeObject extends DurableObject<Env> {
  readonly #repository: ChallengeRepository;

  constructor(context: DurableObjectState, env: Env) {
    super(context, env);
    this.#repository = new ChallengeRepository(
      context.storage as unknown as ChallengeStorage,
    );
  }

  async initialize(record: StoredChallenge): Promise<boolean> {
    return this.#repository.initialize(record);
  }

  async consume(nowIso: string): Promise<ConsumeResult> {
    const now = strictDate(nowIso);
    return this.#repository.consume(now);
  }

  async getForVerification(nowIso: string): Promise<ChallengeLookupResult> {
    const now = strictDate(nowIso);
    return this.#repository.getForVerification(now);
  }

  override async alarm(): Promise<void> {
    const now = new Date();
    const record = await this.#repository.expire(now);
    if (record === null) {
      return;
    }
    const cleanupAt =
      Date.parse(record.expirationTime) + CHALLENGE_RETENTION_MS;
    if (now.getTime() >= cleanupAt) {
      await this.#repository.deleteAll();
      return;
    }
    await this.#repository.scheduleCleanup(record);
  }
}

function strictDate(value: string): Date {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }
  const date = new Date(milliseconds);
  if (date.toISOString() !== value) {
    throw new SafeError("INVALID_REQUEST", 400, false, "request");
  }
  return date;
}
