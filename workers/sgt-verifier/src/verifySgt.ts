import { getMintDecoder } from "@solana-program/token-2022";
import { address, unwrapOption, type Address } from "@solana/kit";
import {
  MAX_TOKEN_ACCOUNT_PAGES,
  MINT_BATCH_SIZE,
  SGT_GROUP_ADDRESS,
  SGT_METADATA_ADDRESS,
  SGT_MINT_AUTHORITY,
  TOKEN_2022_PROGRAM_ID,
} from "./constants";
import { SafeError } from "./errors";
import type { SgtRpcClient, VerificationResult } from "./types";

export async function verifySgtOwnership(
  walletAddress: Address,
  rpc: SgtRpcClient,
  signal: AbortSignal,
  maxPages = MAX_TOKEN_ACCOUNT_PAGES,
): Promise<VerificationResult> {
  const observedSlot = await rpc.getObservedSlot(signal);
  const seenPaginationKeys = new Set<string>();
  const candidateMints = new Set<Address>();
  let paginationKey: string | undefined;
  let pageCount = 0;

  do {
    if (pageCount >= maxPages) {
      throw new SafeError(
        "PAGINATION_LIMIT_REACHED",
        503,
        true,
        "pagination_limit",
      );
    }

    const page = await rpc.getTokenAccountPage(
      walletAddress,
      paginationKey,
      observedSlot,
      signal,
    );
    pageCount += 1;

    for (const rawAccount of page.accounts) {
      const candidate = parseCandidateTokenAccount(rawAccount, walletAddress);
      if (candidate !== null) {
        candidateMints.add(candidate);
      }
    }

    if (page.paginationKey === null) {
      paginationKey = undefined;
      continue;
    }
    if (seenPaginationKeys.has(page.paginationKey)) {
      throw new SafeError("PAGINATION_LOOP", 502, true, "pagination_loop");
    }
    seenPaginationKeys.add(page.paginationKey);
    paginationKey = page.paginationKey;
  } while (paginationKey !== undefined);

  const candidates = [...candidateMints];
  const matchingMints = new Set<string>();
  let checkedMintCount = 0;

  for (let start = 0; start < candidates.length; start += MINT_BATCH_SIZE) {
    const batch = candidates.slice(start, start + MINT_BATCH_SIZE);
    const accounts = await rpc.getMintAccounts(batch, observedSlot, signal);
    if (accounts.length !== batch.length) {
      throw new SafeError(
        "MALFORMED_UPSTREAM_RESPONSE",
        502,
        true,
        "upstream_schema",
      );
    }

    for (let index = 0; index < batch.length; index += 1) {
      checkedMintCount += 1;
      const mintAddress = batch[index];
      const account = accounts[index];
      if (account === null) {
        throw malformedRpc();
      }
      if (isGenuineSgtMint(mintAddress, account.owner, account.data)) {
        matchingMints.add(mintAddress);
      }
    }
  }

  const sgtMintAddresses = [...matchingMints].sort();
  return {
    status: sgtMintAddresses.length > 0 ? "detected" : "not_detected",
    observedSlot,
    sgtMintAddresses,
    stats: {
      pageCount,
      candidateCount: candidates.length,
      checkedMintCount,
    },
  };
}

function parseCandidateTokenAccount(
  value: unknown,
  walletAddress: Address,
): Address | null {
  if (
    !isRecord(value) ||
    typeof value.pubkey !== "string" ||
    !isRecord(value.account)
  ) {
    throw malformedRpc();
  }

  parseAddress(value.pubkey);
  if (
    value.account.owner !== TOKEN_2022_PROGRAM_ID ||
    !isRecord(value.account.data)
  ) {
    throw malformedRpc();
  }
  const parsed = value.account.data.parsed;
  if (
    !isRecord(parsed) ||
    (parsed.type !== undefined && parsed.type !== "account") ||
    !isRecord(parsed.info)
  ) {
    throw malformedRpc();
  }
  const info = parsed.info;
  if (
    info.owner !== walletAddress ||
    typeof info.mint !== "string" ||
    !isRecord(info.tokenAmount)
  ) {
    throw malformedRpc();
  }
  const amount = info.tokenAmount.amount;
  if (
    typeof amount !== "string" ||
    !/^(0|[1-9]\d{0,19})$/.test(amount) ||
    BigInt(amount) > 18_446_744_073_709_551_615n
  ) {
    throw malformedRpc();
  }

  const mint = parseAddress(info.mint);
  return BigInt(amount) > 0n ? mint : null;
}

function isGenuineSgtMint(
  mintAddress: Address,
  owner: string,
  data: Uint8Array,
): boolean {
  if (owner !== TOKEN_2022_PROGRAM_ID) {
    return false;
  }

  try {
    const mint = getMintDecoder().decode(data);
    if (
      !mint.isInitialized ||
      unwrapOption(mint.mintAuthority) !== SGT_MINT_AUTHORITY
    ) {
      return false;
    }

    const extensions = unwrapOption(mint.extensions) ?? [];
    const metadataPointers = extensions.filter(
      (extension) => extension.__kind === "MetadataPointer",
    );
    const groupMembers = extensions.filter(
      (extension) => extension.__kind === "TokenGroupMember",
    );
    if (metadataPointers.length !== 1 || groupMembers.length !== 1) {
      return false;
    }

    const metadataPointer = metadataPointers[0];
    const groupMember = groupMembers[0];
    return (
      unwrapOption(metadataPointer.authority) === SGT_MINT_AUTHORITY &&
      unwrapOption(metadataPointer.metadataAddress) === SGT_METADATA_ADDRESS &&
      groupMember.mint === mintAddress &&
      groupMember.group === SGT_GROUP_ADDRESS
    );
  } catch {
    throw malformedRpc();
  }
}

function parseAddress(value: string): Address {
  try {
    return address(value);
  } catch {
    throw malformedRpc();
  }
}

function malformedRpc(): SafeError {
  return new SafeError(
    "MALFORMED_UPSTREAM_RESPONSE",
    502,
    true,
    "upstream_schema",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
