import { describe, expect, it } from "vitest";
import { createChallenge } from "../src/challenge";
import { ChallengeRepository } from "../src/storage";
import { FIXED_NOW, MemoryChallengeStorage, WALLET_ADDRESS } from "./helpers";

function challenge() {
  let byte = 0;
  return createChallenge(WALLET_ADDRESS, FIXED_NOW, (length) =>
    new Uint8Array(length).fill(++byte),
  );
}

describe("ChallengeRepository", () => {
  it("persists across repository re-instantiation", async () => {
    const storage = new MemoryChallengeStorage();
    const firstInstance = new ChallengeRepository(storage);
    const record = challenge();
    expect(await firstInstance.initialize(record)).toBe(true);

    const restartedInstance = new ChallengeRepository(storage);
    await expect(restartedInstance.get()).resolves.toEqual(record);
  });

  it("allows issued to consumed exactly once", async () => {
    const repository = new ChallengeRepository(new MemoryChallengeStorage());
    const record = challenge();
    await repository.initialize(record);

    await expect(repository.consume(FIXED_NOW)).resolves.toBe("consumed");
    await expect(repository.consume(FIXED_NOW)).resolves.toBe(
      "already_consumed",
    );
    await expect(repository.get()).resolves.toMatchObject({
      status: "consumed",
    });
  });

  it("never allows a consumed challenge to become issued again", async () => {
    const repository = new ChallengeRepository(new MemoryChallengeStorage());
    const record = challenge();
    await repository.initialize(record);
    await repository.consume(FIXED_NOW);

    await expect(repository.initialize(record)).resolves.toBe(false);
    await expect(repository.get()).resolves.toMatchObject({
      status: "consumed",
    });
  });

  it("marks an expired challenge and refuses consumption", async () => {
    const repository = new ChallengeRepository(new MemoryChallengeStorage());
    const record = challenge();
    await repository.initialize(record);
    const afterExpiry = new Date(Date.parse(record.expirationTime) + 1);

    await expect(repository.consume(afterExpiry)).resolves.toBe("expired");
    await expect(repository.get()).resolves.toMatchObject({
      status: "expired",
    });
  });

  it("serializes concurrent consumers so exactly one succeeds", async () => {
    const repository = new ChallengeRepository(new MemoryChallengeStorage());
    await repository.initialize(challenge());

    const results = await Promise.all(
      Array.from({ length: 12 }, () => repository.consume(FIXED_NOW)),
    );
    expect(results.filter((result) => result === "consumed")).toHaveLength(1);
    expect(
      results.filter((result) => result === "already_consumed"),
    ).toHaveLength(11);
  });
});
