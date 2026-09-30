# Stampd SGT Verifier

Read-only Cloudflare Worker for Stampd Stage 5A. It accepts a public Solana wallet address, reads
canonical mainnet Token-2022 state through Helius, and returns `detected`, `not_detected`, or
`unable`.

The Worker has no wallet, signing, transaction, transfer, database, or persistent address storage
capability. It is separate from Stampd's identity Worker.

## Local checks

```powershell
npm.cmd ci
npm.cmd run check
```

## Secret and deployment

Configure the Helius key locally without placing it in source control:

```powershell
npx.cmd wrangler secret put HELIUS_API_KEY
```

Then deploy only after tests pass:

```powershell
npm.cmd run deploy
```

The intended endpoint is `https://sgt.stampdpass.com/v1/sgt/check`.
