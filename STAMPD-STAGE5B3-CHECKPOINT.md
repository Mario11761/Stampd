# Stampd Stage 5B.3 checkpoint — wallet control, Phantom identity blocker

Checkpoint date: 2026-09-22. This is a recoverable source checkpoint, not a release approval.

**Stage 5B.3 is checkpointed but NOT finally sealed.**

**Stage 5B.4 must not begin until separately approved.**

## Scope and architecture

Stage 5B.3 adds an explicitly initiated, development-only Sign-In With Solana (SIWS) wallet-control check to the existing Stampd Android app. It does not grant Seeker status, move funds, or change the Stage 3 wallet connect/disconnect flow. The existing Mobile Wallet Adapter (MWA) identity is Stampd at `https://identity.stampdpass.com`; wallet connection remains on Solana devnet. The SIWS challenge contains a declarative chain identifier; it does not switch the MWA connection to mainnet or submit a transaction.

The mobile app, the already separate Stage 5B challenge/verification Worker at `https://auth.stampdpass.com`, and the wallet have distinct responsibilities:

1. The connected user chooses **Verify Wallet Control** and sees a safety sheet. Cancel makes no challenge or wallet request.
2. After explicit Continue, the mobile app requests a short-lived challenge from `POST /v1/siws/challenge` for the currently connected public address.
3. The app validates the challenge fields, address, identity origin, and five-minute expiry before requesting wallet approval through MWA `authorize` with SIWS payload support.
4. The app checks that the wallet response belongs to the captured connected address and account, then submits the proof to `POST /v1/siws/verify`.
5. The Worker reconstructs the canonical challenge from its server-side record, verifies the Ed25519 proof, and atomically consumes the challenge. A successful response establishes _wallet control only_.

The app accepts only a valid verification response for the same public address. The resulting wallet-control proof lives in React state and expires after five minutes. It is cleared by disconnect, account/session replacement, app restart, or expiry; it is not written to persistent storage. The verification card and diagnostic breadcrumbs are guarded by `__DEV__` and are **not active in the standalone release-like identity-preview APK**.

## P0 wallet and funds boundaries

- Wallet control requires an explicit safety-sheet confirmation. No automatic approval is added.
- This phase can request SIWS message approval only. It adds no transaction signing, transaction submission, SOL/SPL/SKR transfer, token approval, SKR claim, or fund-moving path.
- No private key, recovery phrase, or seed phrase is accessed or requested.
- No wallet proof or sensitive wallet data is logged. Development diagnostics use fixed safe status labels only.
- The existing MWA version, verified identity origin, Android package, DAL, and local disconnect semantics remain unchanged.
- Read-only SGT detection remains separate. **Verified Seeker is not implemented.**

## P1 expiry stabilization

The earlier P1 defect allowed an in-flight SIWS attempt to outlive its server challenge. The controller now schedules challenge expiry from the server-provided time and rejects late wallet or verification results, including results that return after expiry. Expiry invalidates the active attempt, clears its pending work, and shows a safe `CHALLENGE_EXPIRED` state. A verified proof also has its own expiry timer. Tests cover expiry while the wallet is open and after the backend call returns.

## Physical-device results reported before this checkpoint

| Wallet   | Stage 5B.3 result                                                                                                                                    | Identity status / limitation                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phantom  | SIWS, backend Wallet Control Verified, cancellation, disconnect cleanup, and restart cleanup previously passed when the identity warning was absent. | **OPEN BLOCKER — Phantom identity interoperability.** The warning can appear briefly and disappear, or remain visible. Never authorize while it remains visible. |
| Jupiter  | SIWS, backend Wallet Control Verified, and disconnect cleanup previously passed.                                                                     | Standalone identity page showed no warning on the same APK.                                                                                                      |
| Solflare | SIWS, backend Wallet Control Verified, and disconnect cleanup previously passed.                                                                     | One transient failure was observed; a retry passed.                                                                                                              |

These are reported real-device observations, not results produced by automated tests in this checkpoint. They do not constitute final acceptance of Phantom identity behavior.

## Standalone identity-preview control test

The diagnostic EAS build `89ac2e76-7adb-4b81-99e1-91573fc3b752` is a release-like APK with bundled JavaScript, no Metro requirement, `android:debuggable=false`, and no active development launcher. It uses package `com.stampd.app`, version `1.0.0` / code `1`, APK SHA-256 `649C69F679297E7A651C53D8F603E4B5EDD4929372620273A86280B9B8ED01DF`, and DAL-compatible signing certificate SHA-256 `D6:0F:A9:94:5A:4E:FA:99:E9:C5:46:6F:11:E7:81:0F:CB:87:30:5A:4A:72:E9:CC:9C:CA:4D:FC:EB:EC:8F:7B`.

On the Android 16 / SDK 36 test phone, `identity.stampdpass.com` is Android App Link **verified**. The `identity-preview` EAS profile is kept solely for diagnostic/release-like identity comparisons; it is **not** the normal `development` profile and does not alter that profile.

Jupiter's control result on this same APK displayed Stampd and `https://identity.stampdpass.com` without an identity warning. Phantom (`app.phantom`, version `26.30.2`, code `52343`, target SDK 36) sometimes showed: “This app's identity could not be verified. It may be impersonating another app.” It sometimes cleared automatically and sometimes persisted. The user did not authorize while the warning remained.

Android activity-chain observations show the same Stampd caller/result relationship for both wallets:

| Wallet foreground Activity                                              | `launchedFromPackage` | `resultTo`                     |
| ----------------------------------------------------------------------- | --------------------- | ------------------------------ |
| `app.phantom/.MainActivity`                                             | `com.stampd.app`      | `com.stampd.app/.MainActivity` |
| `ag.jup.jupiter.android/.activity.solana.SolanaExternalConnectActivity` | `com.stampd.app`      | `com.stampd.app/.MainActivity` |

This rules out a simple wrong-caller explanation in the observed Android activity chain, but does not expose either wallet's internal identity-verification decision. No concrete Stampd defect has been found; this is **not** a conclusive claim that Phantom is defective. The warning remains an **OPEN BLOCKER — Phantom identity interoperability**.

## Validation and limitations

Checkpoint acceptance requires the Stage 5B.3 SIWS tests, Stage 5A tests, Stage 4 QR tests, TypeScript, ESLint, Prettier, the exact-version/sensitive-log MWA verifier, Expo Doctor, and `git diff --check` to pass. The expected automated test split is 73 SIWS + 9 Stage 5A + 13 Stage 4 QR = 95. Final measured results belong in the checkpoint report.

This checkpoint is not a final Stage 5B.3 seal, production-readiness declaration, Phantom warning waiver, or Stage 5B.4 authorization. Its standalone APK isolates identity from Metro but does not test the development-only SIWS UI. Remaining work requires a separate, safe Phantom identity root-cause diagnosis and later explicit approval before any new stage.
