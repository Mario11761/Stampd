# Stampd Auth Verifier

Stage 5B backend authentication infrastructure for Stampd. This isolated Cloudflare Worker issues short-lived, server-generated SIWS challenges and verifies wallet-control proofs at:

```text
POST /v1/siws/challenge
POST /v1/siws/verify
```

Verification reconstructs the canonical message only from the stored challenge, requires exact message bytes and an Ed25519 signature, then atomically consumes the challenge. It does not invoke wallets, sign messages, create transactions, move funds, create login sessions, or display `Verified Seeker`.

## Security model

- SQLite-backed Durable Object namespace: `SIWS_CHALLENGES`
- One Durable Object per cryptographically random request ID
- 128-bit nonce and independent 128-bit request ID
- Five-minute immutable challenge TTL
- Transactional `issued → consumed` transition after successful verification
- Canonical SIWS construction through the official Solana Wallet Standard utility
- Ed25519 verification through Cloudflare's native Web Crypto implementation
- Exactly one successful verifier can consume a challenge
- Expired and consumed challenges cannot return to `issued`
- Dedicated IP and wallet-keyed rate limiting
- No request bodies, wallet addresses, nonces, messages, or credentials in production logs

## Local validation

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd audit
```

The custom domain is `auth.stampdpass.com`. Production deployment must follow a successful official Wrangler dry-run outside the Codex sandbox.
