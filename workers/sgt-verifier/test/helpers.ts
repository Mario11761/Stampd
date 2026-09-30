import { getMintEncoder, type ExtensionArgs } from "@solana-program/token-2022";
import { getAddressDecoder, none, some, type Address } from "@solana/kit";
import {
  SGT_GROUP_ADDRESS,
  SGT_METADATA_ADDRESS,
  SGT_MINT_AUTHORITY,
  TOKEN_2022_PROGRAM_ID,
} from "../src/constants";
import type {
  MintAccountValue,
  SafeLogEvent,
  SgtRpcClient,
  TokenAccountPage,
  WorkerDependencies,
} from "../src/types";

const decodeAddress = getAddressDecoder();

export const WALLET_ADDRESS = fixtureAddress(1);
export const TOKEN_ACCOUNT_ADDRESS = fixtureAddress(2);
export const FIRST_MINT_ADDRESS = fixtureAddress(3);
export const SECOND_MINT_ADDRESS = fixtureAddress(4);
export const WRONG_ADDRESS = fixtureAddress(5);

export function fixtureAddress(byte: number): Address {
  return decodeAddress.decode(new Uint8Array(32).fill(byte));
}

export function tokenAccount(
  options: {
    mint?: Address;
    amount?: string;
    walletAddress?: Address;
    programOwner?: string;
    extraInfo?: Record<string, unknown>;
  } = {},
): unknown {
  return {
    pubkey: TOKEN_ACCOUNT_ADDRESS,
    account: {
      owner: options.programOwner ?? TOKEN_2022_PROGRAM_ID,
      data: {
        program: "spl-token",
        parsed: {
          info: {
            mint: options.mint ?? FIRST_MINT_ADDRESS,
            owner: options.walletAddress ?? WALLET_ADDRESS,
            tokenAmount: {
              amount: options.amount ?? "1",
              decimals: 0,
              uiAmountString: "1",
            },
            ...options.extraInfo,
          },
        },
      },
    },
  };
}

export function mintAccount(
  options: {
    mintAddress?: Address;
    mintAuthority?: Address;
    metadataAuthority?: Address;
    metadataAddress?: Address;
    group?: Address;
    groupMemberMint?: Address;
    programOwner?: string;
    includeMetadataPointer?: boolean;
    includeGroupMember?: boolean;
  } = {},
): MintAccountValue {
  const mintAddress = options.mintAddress ?? FIRST_MINT_ADDRESS;
  const extensions: ExtensionArgs[] = [];

  if (options.includeMetadataPointer !== false) {
    extensions.push({
      __kind: "MetadataPointer",
      authority: some(options.metadataAuthority ?? SGT_MINT_AUTHORITY),
      metadataAddress: some(options.metadataAddress ?? SGT_METADATA_ADDRESS),
    });
  }
  if (options.includeGroupMember !== false) {
    extensions.push({
      __kind: "TokenGroupMember",
      mint: options.groupMemberMint ?? mintAddress,
      group: options.group ?? SGT_GROUP_ADDRESS,
      memberNumber: 1n,
    });
  }

  return {
    owner: options.programOwner ?? TOKEN_2022_PROGRAM_ID,
    data: Uint8Array.from(
      getMintEncoder().encode({
        mintAuthority: some(options.mintAuthority ?? SGT_MINT_AUTHORITY),
        supply: 1n,
        decimals: 0,
        isInitialized: true,
        freezeAuthority: none(),
        extensions: some(extensions),
      }),
    ),
  };
}

export class StubRpcClient implements SgtRpcClient {
  observedSlot = 123;
  pages: TokenAccountPage[] = [{ accounts: [], paginationKey: null }];
  mintAccounts = new Map<string, MintAccountValue | null>();
  failMintFetch = false;
  pageCalls = 0;
  mintCalls = 0;

  async getObservedSlot(): Promise<number> {
    return this.observedSlot;
  }

  async getTokenAccountPage(): Promise<TokenAccountPage> {
    const page = this.pages[this.pageCalls];
    this.pageCalls += 1;
    if (!page) {
      throw new Error("Unexpected page request");
    }
    return page;
  }

  async getMintAccounts(
    mintAddresses: readonly Address[],
  ): Promise<(MintAccountValue | null)[]> {
    this.mintCalls += 1;
    if (this.failMintFetch) {
      throw new Error("Injected mint failure");
    }
    return mintAddresses.map(
      (mintAddress) => this.mintAccounts.get(mintAddress) ?? null,
    );
  }
}

export function makeDependencies(
  fetcher: WorkerDependencies["fetch"],
  logs: SafeLogEvent[] = [],
): WorkerDependencies {
  return {
    fetch: fetcher,
    now: () => new Date("2026-09-17T04:00:00.000Z"),
    randomUUID: () => "request-id",
    log: (event) => logs.push(event),
  };
}

export function rpcResponse(requestBody: unknown, result: unknown): Response {
  const id = isRecord(requestBody) ? requestBody.id : undefined;
  return Response.json({ jsonrpc: "2.0", id, result });
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
