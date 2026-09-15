# Feature boundaries

Product integrations will be added here in later phases. Keep each area isolated so native and
onchain concerns do not leak into presentation code:

- `wallet/` — Solana Mobile Wallet Adapter session and signature flows.
- `scanner/` — camera permissions and merchant QR parsing.
- `loyalty/` — stamps, merchant interactions, and passport state.
- `seeker/` — Seeker Genesis Token verification.
- `rewards/` — SKR reward eligibility and redemption.

These modules are intentionally not implemented or installed in the initial setup.
