import { describe, expect, it } from "vitest";
import { HeliusRpcClient } from "../src/helius";
import {
  FIRST_MINT_ADDRESS,
  WALLET_ADDRESS,
  isRecord,
  rpcResponse,
  toBase64,
} from "./helpers";

const signal = () => new AbortController().signal;

describe("HeliusRpcClient", () => {
  it("accepts the documented default empty page and requests withContext false", async () => {
    let config: Record<string, unknown> | undefined;
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const params = body.params as unknown[];
      config = params[2] as Record<string, unknown>;
      return rpcResponse(body, { value: [], paginationKey: null });
    });

    const page = await client.getTokenAccountPage(
      WALLET_ADDRESS,
      undefined,
      123,
      signal(),
    );

    expect(page).toEqual({ accounts: [], paginationKey: null });
    expect(config).toMatchObject({ withContext: false });
  });

  it("accepts the documented default account array", async () => {
    const account = { pubkey: "safe-test", account: { data: {} } };
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, { value: [account], paginationKey: null });
    });

    await expect(
      client.getTokenAccountPage(WALLET_ADDRESS, undefined, 123, signal()),
    ).resolves.toEqual({ accounts: [account], paginationKey: null });
  });

  it("accepts an absent final paginationKey", async () => {
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, { value: [] });
    });

    await expect(
      client.getTokenAccountPage(WALLET_ADDRESS, undefined, 123, signal()),
    ).resolves.toEqual({ accounts: [], paginationKey: null });
  });

  it("accepts the documented withContext empty page", async () => {
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, {
        context: { slot: 123, apiVersion: "test" },
        value: { accounts: [], paginationKey: null },
      });
    });

    await expect(
      client.getTokenAccountPage(WALLET_ADDRESS, undefined, 123, signal()),
    ).resolves.toEqual({ accounts: [], paginationKey: null });
  });

  it("accepts documented withContext accounts and paginationKey", async () => {
    const account = { pubkey: "safe-test", account: { data: {} } };
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, {
        context: { slot: 123 },
        value: { accounts: [account], paginationKey: "NextPage1" },
      });
    });

    await expect(
      client.getTokenAccountPage(WALLET_ADDRESS, undefined, 123, signal()),
    ).resolves.toEqual({ accounts: [account], paginationKey: "NextPage1" });
  });

  it.each([
    [
      "value object without accounts",
      { context: { slot: 123 }, value: { paginationKey: null } },
    ],
    [
      "non-array accounts",
      {
        context: { slot: 123 },
        value: { accounts: {}, paginationKey: null },
      },
    ],
  ])("fails closed for withContext %s", async (_label, result) => {
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, result);
    });

    await expect(
      client.getTokenAccountPage(WALLET_ADDRESS, undefined, 123, signal()),
    ).rejects.toMatchObject({
      code: "MALFORMED_UPSTREAM_RESPONSE_TOKEN_PAGE_ACCOUNTS",
    });
  });

  it("sends and reads the exact paginationKey field", async () => {
    const requestBodies: Record<string, unknown>[] = [];
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requestBodies.push(body);
      return rpcResponse(body, {
        value: [],
        paginationKey: requestBodies.length === 1 ? "NextPage1" : null,
      });
    });

    const first = await client.getTokenAccountPage(
      WALLET_ADDRESS,
      undefined,
      123,
      signal(),
    );
    const second = await client.getTokenAccountPage(
      WALLET_ADDRESS,
      first.paginationKey ?? undefined,
      123,
      signal(),
    );

    expect(first.paginationKey).toBe("NextPage1");
    expect(second.paginationKey).toBeNull();
    const firstParams = requestBodies[0].params as unknown[];
    const secondParams = requestBodies[1].params as unknown[];
    expect(firstParams[2]).not.toHaveProperty("paginationKey");
    expect(secondParams[2]).toMatchObject({ paginationKey: "NextPage1" });
  });

  it("uses only the hardcoded Helius origin and server API key", async () => {
    let calledUrl = "";
    const client = new HeliusRpcClient("test-api-key", async (url, init) => {
      calledUrl = url;
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, 123);
    });

    await client.getObservedSlot(signal());
    const parsedUrl = new URL(calledUrl);
    expect(parsedUrl.origin).toBe("https://mainnet.helius-rpc.com");
    expect(parsedUrl.searchParams.get("api-key")).toBe("test-api-key");
  });

  it("strictly decodes complete getMultipleAccounts batches", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, {
        context: { slot: 123 },
        value: [{ owner: "owner", data: [toBase64(bytes), "base64"] }],
      });
    });

    const result = await client.getMintAccounts(
      [FIRST_MINT_ADDRESS],
      123,
      signal(),
    );
    expect(result[0]).toEqual({ owner: "owner", data: bytes });
  });

  it.each([
    [
      "missing result",
      { jsonrpc: "2.0", id: "wrong" },
      "MALFORMED_UPSTREAM_RESPONSE_TOKEN_PAGE",
    ],
    [
      "malformed page",
      { jsonrpc: "2.0", id: "replace", result: { value: {} } },
      "MALFORMED_UPSTREAM_RESPONSE_TOKEN_PAGE_CONTEXT",
    ],
  ])("fails closed for a %s response", async (_label, template, code) => {
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const responseBody = {
        ...template,
        id: template.id === "replace" ? body.id : template.id,
      };
      return Response.json(responseBody);
    });

    await expect(
      client.getTokenAccountPage(WALLET_ADDRESS, undefined, 123, signal()),
    ).rejects.toMatchObject({
      code,
    });
  });

  it("maps an HTTP failure to an unavailable error", async () => {
    const client = new HeliusRpcClient(
      "test-api-key",
      async () => new Response("down", { status: 503 }),
    );
    await expect(client.getObservedSlot(signal())).rejects.toMatchObject({
      code: "UPSTREAM_HTTP_ERROR",
    });
  });

  it("maps a JSON-RPC error to an unavailable error", async () => {
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32000, message: "safe test" },
      });
    });

    await expect(client.getObservedSlot(signal())).rejects.toMatchObject({
      code: "UPSTREAM_RPC_NEG_32000_SLOT",
    });
  });

  it("reports only an unknown JSON-RPC numeric code and request stage", async () => {
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32016,
          message: "must remain undisclosed",
          data: { sensitive: "must remain undisclosed" },
        },
      });
    });

    await expect(
      client.getTokenAccountPage(WALLET_ADDRESS, undefined, 123, signal()),
    ).rejects.toMatchObject({
      code: "UPSTREAM_RPC_NEG_32016_TOKEN_PAGE",
      failureCategory: "upstream_rpc_neg_32016_token_page",
    });
  });

  it("times out and does not treat the timeout as not_detected", async () => {
    const client = new HeliusRpcClient(
      "test-api-key",
      async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
      5,
    );

    await expect(client.getObservedSlot(signal())).rejects.toMatchObject({
      code: "UPSTREAM_TIMEOUT",
    });
  });

  it("fails closed when a mint batch is partial", async () => {
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, { context: { slot: 123 }, value: [] });
    });

    await expect(
      client.getMintAccounts([FIRST_MINT_ADDRESS], 123, signal()),
    ).rejects.toMatchObject({
      code: "MALFORMED_UPSTREAM_RESPONSE_MINT_BATCH",
    });
  });

  it("rejects an invalid paginationKey rather than using it", async () => {
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return rpcResponse(body, { value: [], paginationKey: "not valid!" });
    });

    await expect(
      client.getTokenAccountPage(WALLET_ADDRESS, undefined, 123, signal()),
    ).rejects.toMatchObject({
      code: "MALFORMED_UPSTREAM_RESPONSE_TOKEN_PAGE_PAGINATION",
    });
  });

  it("does not accept a JSON-RPC envelope with mismatched id", async () => {
    const client = new HeliusRpcClient("test-api-key", async () =>
      Response.json({ jsonrpc: "2.0", id: "attacker-id", result: 123 }),
    );

    await expect(client.getObservedSlot(signal())).rejects.toMatchObject({
      code: "MALFORMED_UPSTREAM_RESPONSE_SLOT",
    });
  });

  it("never needs a user-provided RPC method or URL", async () => {
    const methods: string[] = [];
    const client = new HeliusRpcClient("test-api-key", async (_url, init) => {
      const body: unknown = JSON.parse(String(init?.body));
      expect(isRecord(body)).toBe(true);
      if (!isRecord(body) || typeof body.method !== "string") {
        throw new Error("bad test body");
      }
      methods.push(body.method);
      return rpcResponse(body, 123);
    });

    await client.getObservedSlot(signal());
    expect(methods).toEqual(["getSlot"]);
  });
});
