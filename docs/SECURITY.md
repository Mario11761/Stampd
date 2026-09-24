# Stampd security model

This document describes the current validated scope. Stampd has not been represented as formally audited or production sealed.

## Non-custodial boundary

Stampd never requests or accesses seed phrases, recovery phrases, private keys, wallet exports, or custody of funds. Mobile Wallet Adapter provides a public address and an in-memory authorization session. Session credentials and raw wallet responses are not shown in production UI or deliberately logged.

## Wallet authorization

Authorization remains on `solana:devnet`. The connect safety sheet precedes the wallet chooser. The product flow reads the public address and does not expose transaction-signing or transaction-submission features. Disconnect invalidates the current local session and related proof state.

## Wallet Control proof

Wallet Control is SIWS message signing, not a transaction:

1. The auth Worker issues a one-time challenge for the captured public address.
2. The challenge is bounded by expected domain, URI, statement, version, mainnet identity scope, timestamps, and nonce rules.
3. The user explicitly approves message signing in the wallet.
4. The auth Worker verifies the returned message/signature and consumes the challenge.
5. Replay, malformed, expired, mismatched, rate-limited, or network-failed requests fail closed.

The verified proof expires strictly after five minutes. The app binds it to the exact public address and current session epoch. A proof for another address or an earlier same-address session cannot derive Verified Seeker.

## Non-persistence and cleanup

- Wallet session: memory-only.
- SIWS proof: memory-only.
- Verified Seeker: derived, never persisted as a boolean.
- Disconnect: increments the session epoch and clears wallet/proof state.
- Same-address reconnect: starts a new epoch and does not inherit the old proof.
- App restart/force-stop: does not restore the wallet session, proof, or Verified Seeker.
- App foreground after proof expiry: re-evaluates time and fails closed.

The Stage 4 demo stamp intentionally persists locally and survives wallet disconnect and app restart.

## SGT verification

Official SGT detection is a read-only Solana mainnet check performed by the dedicated verifier Worker for the connected public address. Results are address-bound. A stale response cannot overwrite a newer address request, and checking/unable/not-detected states cannot derive Verified Seeker. There is no runtime fake-SGT or production bypass path.

## QR and camera safety

The scanner accepts only an object with the exact version, type, merchant ID, stamp ID, and key set. It rejects malformed JSON, extra keys, wrong values, non-object input, empty input, and oversized payloads. A duplicate accepted code does not create another stamp.

Expo Camera is configured for barcode scanning with audio recording disabled. Stampd does not save photos, upload images, upload camera frames, or invoke a wallet from the QR flow.

## Local persistence limitations

The accepted demo stamp is stored with AsyncStorage. This is suitable for a transparent hackathon demo, not a tamper-proof merchant ledger. Clearing app storage removes it. There is no server synchronization, multi-device consistency, fraud-resistant issuance, or onchain stamp record in the current build.

## Transactions and funds

The product does not implement transaction signing, transaction submission, SOL transfers, SPL transfers, SKR transfers, token approvals, reward redemption, or SKR claims. SKR figures are UI-only demo reward targets and do not represent a balance or ownership.

## Identity and wallet interoperability

- **Seed Vault:** validated real-device path for connection, real official SGT detection, SIWS, and positive Verified Seeker.
- **Solflare:** validated real-device path for wallet authorization, SIWS, the no-SGT negative path, and fail-closed behavior. It was not the real-SGT positive wallet.
- **Phantom:** open interoperability limitation. A red identity warning has appeared inconsistently despite matching package, signing certificate, Android App Link, DAL, identity origin, and caller-chain evidence. Never authorize while that warning is visible; no bypass or wallet-specific workaround is implemented.
- **Jupiter:** has shown normal identity in prior standalone tests, with separate intermittent request-verification behavior previously observed.
- **Solflare cancellation:** if the wallet supplies no primitive cancellation code, Stampd keeps the generic fail-closed `Unable to Verify Wallet Control` result rather than guessing from a message string.

## Operational limits

- SGT and SIWS verification require their HTTPS services and upstream network/provider availability.
- The three Worker projects are deployed components outside this versioned mobile repository and need a separate submission-packaging review.
- Rate limiting, bounded payloads, short timeouts, narrow response parsing, proof expiry, and fail-closed UI reduce risk but do not constitute a formal security audit.
- General production exposure is not approved by the current checkpoint.

## Responsible evidence handling

Screenshots, logs, and demos must exclude full wallet addresses, raw signatures, authorization tokens, challenge nonces, request IDs, association URLs/query strings, private keys, seed phrases, and provider credentials. Use shortened public addresses and status-only evidence.
