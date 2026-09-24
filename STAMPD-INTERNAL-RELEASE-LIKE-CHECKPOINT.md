# Stampd Internal Release-Like Checkpoint

Date: 2026-09-24

Scope: Stage 5B.4 internal release-like Wallet Control and Verified Seeker exposure

Baseline checkpoint: `8fbdbb47051ae78d4314fabf9134cafadf2fb2d3` (`stage-5b4-verified-seeker-checkpoint`)

**Internal release-like exposure: PASS**

**General production exposure: NO**

This is a checkpoint, not a production seal. It does not authorize Stage 6, reward claims, transactions, token transfers, or general public release.

## Implementation recorded

- The existing Wallet Control and derived Verified Seeker UI is exposed in the `identity-preview` EAS profile through `EXPO_PUBLIC_INTERNAL_IDENTITY_PREVIEW_ENABLED=true`.
- The product gate is enabled only in development or when that environment value is exactly `true`; it remains off by default in other non-development builds.
- Development diagnostics remain guarded explicitly by `__DEV__` and are absent from the release-like build.
- Wallet Control keeps the existing one-time SIWS message flow, five-minute expiry, address binding, and session-epoch binding.
- Verified Seeker remains pure derived display state. It requires both an address-bound official SGT result and a current SIWS proof for the same address and session epoch.
- SIWS proof and Verified Seeker status remain memory-only. Neither is persisted.
- Stage 4 loyalty state remains locally persistent and independent of wallet/SIWS session state.
- User-facing release copy states that SIWS is not a transaction, requests no token approval, moves no SOL/tokens/SKR, and has no network fee.

## Validated release-like APK

| Property                    | Validated value                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| EAS Build ID                | `6c175360-4cb3-4425-9d43-fce13999d3a0`                                                            |
| Android package             | `com.stampd.app`                                                                                  |
| APK SHA-256                 | `1F26304D41DFF0AE173874C1D767EAACB466FEC0C777C5DA7F2FC8F6836B76A2`                                |
| Signing certificate SHA-256 | `D6:0F:A9:94:5A:4E:FA:99:E9:C5:46:6F:11:E7:81:0F:CB:87:30:5A:4A:72:E9:CC:9C:CA:4D:FC:EB:EC:8F:7B` |
| Debuggable                  | No                                                                                                |
| Metro required              | No                                                                                                |
| Development Launcher active | No                                                                                                |
| Internal feature gate       | On                                                                                                |
| Development-only UI         | Absent                                                                                            |

## Automated validation

| Check                            | Result       |
| -------------------------------- | ------------ |
| Stage 5B.4 Verified Seeker tests | PASS — 20/20 |
| Stage 5B.3 SIWS tests            | PASS — 80/80 |
| Stage 5A SGT tests               | PASS — 9/9   |
| Stage 4 QR tests                 | PASS — 13/13 |
| TypeScript                       | PASS         |
| ESLint                           | PASS         |
| Prettier                         | PASS         |
| Expo Doctor                      | PASS — 21/21 |
| MWA sensitive-logging verifier   | PASS         |
| `git diff --check`               | PASS         |
| P0 forbidden-capability scan     | PASS         |

Automated feature-test total: **122/122 passed**.

The P0 scan found no active transaction-signing, transaction-submission, transfer, SKR-claim, private/secret-key, mnemonic, fake-SGT override, or `mainnet-beta` implementation. Broad text matches for seed/private-key terms were limited to protective user-facing copy, not executable access paths.

## Physical-device acceptance matrix

| Scenario                                                                                        | Result |
| ----------------------------------------------------------------------------------------------- | ------ |
| Solflare connection                                                                             | PASS   |
| Wallet Control UI visible in release-like build                                                 | PASS   |
| Development diagnostics absent                                                                  | PASS   |
| Stage 4 development reset control absent                                                        | PASS   |
| SIWS safety sheet and required safety copy                                                      | PASS   |
| Solflare SIWS signing                                                                           | PASS   |
| Wallet Control Verified displayed after valid verification                                      | PASS   |
| No SGT plus valid SIWS does not show Verified Seeker                                            | PASS   |
| More than five minutes causes verification to expire and restores the verify action             | PASS   |
| Force-stop/reopen clears wallet, SIWS proof, and Verified Seeker while preserving loyalty state | PASS   |
| Same-address disconnect/reconnect within the old proof TTL does not inherit the old proof       | PASS   |
| Stage 4 loyalty persistence: 13 Stamps, 3 Places, 40 SKR Earned                                 | PASS   |

The same-address epoch-isolation test used address `CcVN...c7PC`: verification occurred at approximately 12:57 and reconnect at approximately 12:59. The old proof was not inherited and the verification UI reset as required.

## Security boundary

| Capability or state                               | Checkpoint status              |
| ------------------------------------------------- | ------------------------------ |
| SIWS one-time message signing                     | Present, user initiated        |
| Transaction signing                               | Absent                         |
| Transaction submission                            | Absent                         |
| SOL, SPL, or SKR fund movement                    | Absent                         |
| Token approvals                                   | Absent                         |
| SKR claim                                         | Not implemented                |
| Seed phrase, private key, or wallet-secret access | Absent                         |
| SIWS proof persistence                            | Absent                         |
| Stored `verifiedSeeker` boolean                   | Absent                         |
| Runtime fake SGT / production bypass              | Absent                         |
| Wallet connection network                         | Solana devnet only             |
| SGT detection                                     | Read-only Solana mainnet query |

No reward eligibility, claim entitlement, or fund movement is conferred by the Verified Seeker display. Any future SKR or transaction stage requires a fresh P0 review and explicit authorization.

## Open limitations and blockers

1. **OPEN BLOCKER — Phantom identity interoperability.** Phantom continues to show an identity-verification warning. Users must cancel when that warning appears; the issue is not considered resolved.
2. **Solflare cancellation classification.** A cancelled Solflare SIWS attempt produced `SolanaMobileWalletAdapterError` with no primitive error code. It remains safely classified as the generic fail-closed “Unable to Verify Wallet Control.” Message matching and broader cancellation mappings are not justified.
3. **No real SGT-holder positive physical test.** Positive Verified Seeker behavior is covered by fixtures and automated tests only. No claim of a real-holder physical PASS is made.
4. This internal release-like gate is not approval for general production exposure.

## Checkpoint decision

The internal release-like Wallet Control and derived Verified Seeker exposure is accepted for the validated internal test scope. General production exposure remains blocked pending resolution or explicit disposition of the Phantom identity issue and completion of a real SGT-holder positive physical test.

**Internal release-like exposure: PASS**

**General production exposure: NO**
