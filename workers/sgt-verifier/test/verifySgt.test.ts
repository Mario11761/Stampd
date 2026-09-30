import { describe, expect, it } from "vitest";
import { SafeError } from "../src/errors";
import { verifySgtOwnership } from "../src/verifySgt";
import {
  FIRST_MINT_ADDRESS,
  SECOND_MINT_ADDRESS,
  StubRpcClient,
  WALLET_ADDRESS,
  WRONG_ADDRESS,
  mintAccount,
  tokenAccount,
} from "./helpers";

const signal = () => new AbortController().signal;

describe("verifySgtOwnership", () => {
  it("returns not_detected only after a complete empty page", async () => {
    const rpc = new StubRpcClient();
    const result = await verifySgtOwnership(WALLET_ADDRESS, rpc, signal());

    expect(result.status).toBe("not_detected");
    expect(result.sgtMintAddresses).toEqual([]);
    expect(result.observedSlot).toBe(123);
  });

  it("detects a genuine SGT using decoded Token-2022 extensions", async () => {
    const rpc = genuineRpc();
    const result = await verifySgtOwnership(WALLET_ADDRESS, rpc, signal());

    expect(result.status).toBe("detected");
    expect(result.sgtMintAddresses).toEqual([FIRST_MINT_ADDRESS]);
  });

  it("accepts the documented Helius V2 parsed account without parsed.type", async () => {
    const rpc = genuineRpc();
    const account = tokenAccount() as {
      account: { data: { parsed: Record<string, unknown> } };
    };

    expect(account.account.data.parsed).not.toHaveProperty("type");
    const result = await verifySgtOwnership(WALLET_ADDRESS, rpc, signal());
    expect(result.status).toBe("detected");
  });

  it("fails closed when parsed.type is present but is not account", async () => {
    const rpc = new StubRpcClient();
    const account = tokenAccount() as {
      account: { data: { parsed: Record<string, unknown> } };
    };
    account.account.data.parsed.type = "mint";
    rpc.pages = [{ accounts: [account], paginationKey: null }];

    await expect(
      verifySgtOwnership(WALLET_ADDRESS, rpc, signal()),
    ).rejects.toMatchObject({ code: "MALFORMED_UPSTREAM_RESPONSE" });
  });

  it("ignores spoof presentation fields and rejects a wrong mint authority", async () => {
    const rpc = new StubRpcClient();
    rpc.pages = [
      {
        accounts: [
          tokenAccount({
            extraInfo: { name: "Seeker Genesis Token", image: "lookalike.png" },
          }),
        ],
        paginationKey: null,
      },
    ];
    rpc.mintAccounts.set(
      FIRST_MINT_ADDRESS,
      mintAccount({ mintAuthority: WRONG_ADDRESS }),
    );

    await expectStatus(rpc, "not_detected");
  });

  it("does not count a zero-balance stale token account", async () => {
    const rpc = genuineRpc("0");
    await expectStatus(rpc, "not_detected");
    expect(rpc.mintCalls).toBe(0);
  });

  it.each([
    ["metadata authority", mintAccount({ metadataAuthority: WRONG_ADDRESS })],
    ["metadata address", mintAccount({ metadataAddress: WRONG_ADDRESS })],
    [
      "missing metadata pointer",
      mintAccount({ includeMetadataPointer: false }),
    ],
    ["group", mintAccount({ group: WRONG_ADDRESS })],
    ["group member mint", mintAccount({ groupMemberMint: WRONG_ADDRESS })],
    ["missing group member", mintAccount({ includeGroupMember: false })],
    ["mint program owner", mintAccount({ programOwner: WRONG_ADDRESS })],
  ])("rejects a mint with the wrong %s", async (_label, account) => {
    const rpc = genuineRpc();
    rpc.mintAccounts.set(FIRST_MINT_ADDRESS, account);
    await expectStatus(rpc, "not_detected");
  });

  it("exhausts multiple pages using paginationKey", async () => {
    const rpc = new StubRpcClient();
    rpc.pages = [
      { accounts: [], paginationKey: "PageKey1" },
      { accounts: [tokenAccount()], paginationKey: null },
    ];
    rpc.mintAccounts.set(FIRST_MINT_ADDRESS, mintAccount());

    const result = await verifySgtOwnership(WALLET_ADDRESS, rpc, signal());
    expect(result.status).toBe("detected");
    expect(result.stats.pageCount).toBe(2);
  });

  it("fails closed on a repeated paginationKey", async () => {
    const rpc = new StubRpcClient();
    rpc.pages = [
      { accounts: [], paginationKey: "PageKey1" },
      { accounts: [], paginationKey: "PageKey1" },
    ];

    await expect(
      verifySgtOwnership(WALLET_ADDRESS, rpc, signal()),
    ).rejects.toMatchObject({
      code: "PAGINATION_LOOP",
    });
  });

  it("fails closed when the pagination safety limit is reached", async () => {
    const rpc = new StubRpcClient();
    rpc.pages = [{ accounts: [], paginationKey: "PageKey1" }];

    await expect(
      verifySgtOwnership(WALLET_ADDRESS, rpc, signal(), 1),
    ).rejects.toMatchObject({
      code: "PAGINATION_LIMIT_REACHED",
    });
  });

  it("fails closed when a mint batch request fails", async () => {
    const rpc = genuineRpc();
    rpc.failMintFetch = true;
    rpc.getMintAccounts = async () => {
      throw new SafeError(
        "UPSTREAM_UNAVAILABLE",
        503,
        true,
        "upstream_network",
      );
    };

    await expect(
      verifySgtOwnership(WALLET_ADDRESS, rpc, signal()),
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("deduplicates repeated token accounts and mint results", async () => {
    const rpc = genuineRpc();
    rpc.pages = [
      {
        accounts: [tokenAccount(), tokenAccount(), tokenAccount()],
        paginationKey: null,
      },
    ];

    const result = await verifySgtOwnership(WALLET_ADDRESS, rpc, signal());
    expect(result.sgtMintAddresses).toEqual([FIRST_MINT_ADDRESS]);
    expect(result.stats.candidateCount).toBe(1);
    expect(result.stats.checkedMintCount).toBe(1);
  });

  it("returns multiple unique genuine SGT mint addresses in sorted order", async () => {
    const rpc = new StubRpcClient();
    rpc.pages = [
      {
        accounts: [
          tokenAccount({ mint: SECOND_MINT_ADDRESS }),
          tokenAccount({ mint: FIRST_MINT_ADDRESS }),
        ],
        paginationKey: null,
      },
    ];
    rpc.mintAccounts.set(
      FIRST_MINT_ADDRESS,
      mintAccount({ mintAddress: FIRST_MINT_ADDRESS }),
    );
    rpc.mintAccounts.set(
      SECOND_MINT_ADDRESS,
      mintAccount({ mintAddress: SECOND_MINT_ADDRESS }),
    );

    const result = await verifySgtOwnership(WALLET_ADDRESS, rpc, signal());
    expect(result.status).toBe("detected");
    expect(result.sgtMintAddresses).toEqual(
      [FIRST_MINT_ADDRESS, SECOND_MINT_ADDRESS].sort(),
    );
  });

  it("fails closed on a malformed token account response", async () => {
    const rpc = new StubRpcClient();
    rpc.pages = [{ accounts: [{ unexpected: true }], paginationKey: null }];

    await expect(
      verifySgtOwnership(WALLET_ADDRESS, rpc, signal()),
    ).rejects.toMatchObject({
      code: "MALFORMED_UPSTREAM_RESPONSE",
    });
  });

  it("fails closed when a Token-2022-filtered page contains another program", async () => {
    const rpc = new StubRpcClient();
    rpc.pages = [
      {
        accounts: [tokenAccount({ programOwner: WRONG_ADDRESS })],
        paginationKey: null,
      },
    ];

    await expect(
      verifySgtOwnership(WALLET_ADDRESS, rpc, signal()),
    ).rejects.toMatchObject({
      code: "MALFORMED_UPSTREAM_RESPONSE",
    });
  });
});

function genuineRpc(amount = "1"): StubRpcClient {
  const rpc = new StubRpcClient();
  rpc.pages = [{ accounts: [tokenAccount({ amount })], paginationKey: null }];
  rpc.mintAccounts.set(FIRST_MINT_ADDRESS, mintAccount());
  return rpc;
}

async function expectStatus(
  rpc: StubRpcClient,
  status: "detected" | "not_detected",
): Promise<void> {
  const result = await verifySgtOwnership(WALLET_ADDRESS, rpc, signal());
  expect(result.status).toBe(status);
}
