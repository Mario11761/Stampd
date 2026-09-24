# Feature boundaries

Stampd keeps wallet, verification, network, scanner, and presentation concerns separated. Current boundaries are:

- `wallet/` — real Solana Mobile Wallet Adapter authorization, memory-only session state, one-time SIWS Wallet Control verification, and safe error handling. It does not expose transaction or fund-moving capabilities.
- `verification/` — pure, fail-closed Verified Seeker derivation from an address-bound SGT result and an unexpired SIWS proof for the same session epoch.
- `seeker/` — read-only official Seeker Genesis Token checks through the dedicated verifier service. It does not mutate tokens or wallet state.
- `stamps/` — strict parsing of one demo QR payload and persistence of the single local Seeker Coffee demo stamp.
- Reward presentation — local demo eligibility and SKR target copy in the app screens/components. There is no claim, redemption, transfer, or reward backend.

Network and state boundaries:

- Wallet authorization: `solana:devnet`.
- SGT verification: Solana mainnet, read-only and server-mediated.
- SIWS: a `solana:mainnet` identity message, never a transaction.
- Wallet session and SIWS proof: memory-only.
- Demo stamp: local AsyncStorage state.

See the root README and `docs/ARCHITECTURE.md` for the end-to-end system view.
