# Stampd Stage 5B.4 checkpoint — derived Verified Seeker status

Checkpoint date: 2026-09-23. This is a recoverable source checkpoint, not a release approval.

**Stage 5B.4 is checkpointed but NOT finally sealed.**

**Verified Seeker is display-only and MUST NOT be used as reward authorization.**

**Any future SKR claim requires a fresh P0 Transaction Architecture Review.**

## Scope

Stage 5B.4 adds the smallest fail-closed combination layer for displaying **Verified Seeker**. It combines the existing read-only Seeker Genesis Token result with the existing memory-only SIWS wallet-control proof. It does not replace either underlying status, create a persistent identity, grant rewards, or add any fund-moving capability.

The existing Stage 5B.3 wallet behavior, MWA version, DAL, identity origin, Android package, Worker contracts, and disconnect semantics remain unchanged.

## Pure derived model and authoritative inputs

Verified Seeker is a pure result derived at render time. There is no independently stored Verified Seeker boolean. The authoritative inputs are:

- the current connected address;
- the current wallet session address and in-memory session epoch;
- the current address-bound SGT state;
- the current SIWS flow state;
- the current memory-only wallet-control proof and its session epoch;
- the current time used to check proof expiry.

The result is true only when the displayed address and current session address match, the SGT status is `detected` for that same address, SIWS is `verified`, the proof belongs to the same address and session epoch, and its canonical expiry is strictly later than the current time. Every unknown, pending, malformed, mismatched, expired, cancelled, failed, or unavailable combination returns false.

## Address and session binding

Local SGT states now retain the captured address used for the check. `checking`, `detected`, `not_detected`, and `unable` are all address-bound; only `idle` has no address. The address is attached by the request controller, and a completed result is published only after its generation and abort checks pass.

This prevents a late Wallet A result from verifying Wallet B. Starting a new SGT check also immediately publishes `checking`, so an earlier positive combination cannot remain visible during refresh.

Every successfully connected wallet session receives a new in-memory epoch. A wallet-control proof is bound to the epoch in which it was created. Reconnecting with the same public address still creates a different session epoch, so the old proof cannot qualify for the new session.

## Expiry and foreground behavior

The existing SIWS proof-expiry timer remains in place. The pure selector independently validates the expiry against its current-time input and rejects malformed timestamps and equality at the expiry boundary. When the app returns to the foreground, it refreshes that time input; a proof that expired while the app was inactive therefore fails closed immediately. No automatic reverification was added.

## Fail-closed rules

Verified Seeker is absent for no wallet, no active session, address or session mismatch, SGT idle/checking/not detected/unable, missing or nonverified SIWS state, missing or mismatched proof, expired or malformed proof, disconnect, restart, address switch, same-address session replacement, late SGT or SIWS completion, network failure, malformed server response, or simultaneous refresh.

Disconnect and restart clear the wallet, SGT combination inputs, and wallet-control proof while preserving the separate Stage 4 local loyalty state.

## UI and development boundary

The existing SGT card and wallet-control card retain their existing wording and remain independently visible. When and only when both current signals qualify for the same address and session, a separate card displays:

> Verified Seeker
>
> SGT and wallet control match this address.

The complete SIWS verification UI was already guarded by `__DEV__`. Stage 5B.4 preserves that boundary: the new Verified Seeker card is also development-only. The release-like identity-preview build does not expose either control. This checkpoint does not broaden production behavior.

## Automated validation

- Stage 5B.4 Verified Seeker: 20/20 passed
- Stage 5B.3 SIWS: 73/73 passed
- Stage 5A SGT: 9/9 passed
- Stage 4 QR: 13/13 passed
- Total: 115/115 passed
- TypeScript, ESLint, Prettier, Expo Doctor 21/21, MWA 2.3.0 sensitive-log verification, and `git diff --check`: passed

The Stage 5B.4 suite covers the positive pure fixture and fail-closed combinations including address switching, same-address session replacement, stale completions, refreshes, cancellation/failure states, exact expiry, malformed expiry, and foreground return after expiry.

## Physical negative-test matrix

| Scenario                                | Result                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SGT Unable with Wallet Control Verified | Verified Seeker absent — PASS                                                                                                         |
| Disconnect cleanup                      | Wallet, SGT, proof, and Verified Seeker cleared; Stage 4 loyalty retained — PASS                                                      |
| Same-address reconnect                  | Old proof not inherited; reverification required; Verified Seeker absent — PASS                                                       |
| App restart                             | Wallet, proof, and Verified Seeker not persisted; Stage 4 loyalty retained — PASS                                                     |
| Solflare SIWS cancellation              | Wallet remains connected; no verified status, automatic retry, or duplicate prompt; manual retry remains available — FAIL-CLOSED PASS |

No real physical wallet holding an official SGT is currently available. The positive combination is covered by pure unit fixtures only; this checkpoint does not claim a real-positive physical Verified Seeker pass.

## Open limitations

**OPEN BLOCKER — Phantom identity interoperability.** Phantom must never be authorized while its red identity warning remains visible. This checkpoint does not change or bypass Phantom handling and does not claim the blocker is resolved.

**OPEN P1/UX interoperability observation — Solflare cancellation classification.** The observed safe diagnostic ended at `MWA_AUTHORIZE_FAILED_SAFE`, not the neutral cancellation label. It remains fail-closed and must not be reclassified without a proven wallet cancellation code.

## P0 boundary

- Explicit SIWS message approval remains the only signing behavior in this stage.
- Transaction signing, transaction submission, transfers, token approvals, minting, SKR claims, and fund movement remain absent.
- SIWS proof persistence and Verified Seeker persistence remain absent.
- No fake production SGT path, hidden override, new credential, or sensitive logging is introduced.
- Verified Seeker is not an entitlement, backend session, or reward authorization mechanism.

This checkpoint does not start Stage 6, Stage 7, or any reward or transaction stage.
