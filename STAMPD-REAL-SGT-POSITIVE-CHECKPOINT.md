# Stampd Real SGT Positive Physical Checkpoint

Date: 2026-09-24

Scope: Stage 5B.4 documentation checkpoint for real official Seeker Genesis Token holder validation

Baseline commit: `455a87c9b9930c776225b541e89c9bfa5a13e375`

Baseline tag: `stage-5b4-internal-release-like-checkpoint`

This is a documentation-only checkpoint. It is not a production seal, does not change product behavior, and does not authorize Stage 6, transactions, reward distribution, or an SKR claim.

## Status

**Real SGT-holder physical validation: PASS**

**Internal release-like exposure: PASS**

**General production exposure: NO**

The previous limitation stating that no real official SGT-holder positive physical test was available is superseded by the physical results recorded in this checkpoint.

## Validated artifact

| Property                    | Validated value                                                    |
| --------------------------- | ------------------------------------------------------------------ |
| EAS Build ID                | `6c175360-4cb3-4425-9d43-fce13999d3a0`                             |
| Android package             | `com.stampd.app`                                                   |
| APK SHA-256                 | `1F26304D41DFF0AE173874C1D767EAACB466FEC0C777C5DA7F2FC8F6836B76A2` |
| Build type                  | Internal release-like, standalone                                  |
| Metro required              | No                                                                 |
| Development Launcher active | No                                                                 |

The observed wallet address was displayed and recorded only in shortened form. No seed phrase, private key, recovery phrase, wallet export, auth token, raw signature, challenge nonce, or sensitive association URL was collected.

## Real official SGT-holder physical validation

### 1. Official SGT detection — PASS

A real wallet holding an official Seeker Genesis Token was connected to the exact validated APK. Stampd displayed:

```text
SGT Detected
```

Detection remained read-only and server-side on Solana mainnet. It did not create a transaction.

### 2. State before SIWS — PASS

Before Wallet Control verification:

- `SGT Detected` was present.
- `Wallet Control Verified` was absent.
- `Verified Seeker` was absent.

This confirms that SGT ownership alone does not derive Verified Seeker.

### 3. Wallet Control SIWS — PASS

The holder explicitly approved Stampd's existing one-time identity message-signing request. The wallet did not request or display:

- A transaction
- A SOL, token, or SKR amount
- A recipient
- A token or delegate approval
- A network fee

Wallet authorization remained on `solana:devnet`. The SIWS identity verification context remained `solana:mainnet`. No transaction was created or submitted.

### 4. Positive derived status — PASS

After successful SIWS, Stampd simultaneously displayed:

```text
SGT Detected
Wallet Control Verified
Verified Seeker
```

This is Stampd's first real official SGT-holder physical positive validation. It demonstrates that Verified Seeker appears when both conditions are true for the exact current address and session:

1. Official SGT detection is positive for the connected address.
2. A current, valid SIWS wallet-control proof exists for that same address and session epoch.

### 5. Five-minute expiry — PASS

After the SIWS proof expired:

- `SGT Detected` remained.
- `Wallet Control Verified` disappeared.
- `Verified Seeker` disappeared.
- `Verify Wallet Control` returned.

This confirms that the derived positive state fails closed at proof expiry while the independent read-only SGT result may remain visible.

### 6. Disconnect and same-address reconnect — PASS

A fresh verified session was established. The holder disconnected and reconnected the same real SGT address inside the prior proof-validity window.

- The old SIWS proof was not inherited.
- `Wallet Control Verified` was not inherited.
- `Verified Seeker` was not inherited.

One temporary SGT query returned `Unable to Check`. This was correctly treated as an inconclusive network/service state and did not grant any positive status. A subsequent reconnect returned:

```text
SGT Detected
Wallet Control Verification
```

At that point, both `Wallet Control Verified` and `Verified Seeker` remained absent. Session-epoch isolation and SGT re-detection therefore passed.

### 7. Restart cleanup — PASS

After creating a current valid Verified Seeker state, Stampd was force-stopped and reopened. The following was observed:

- `Connect Wallet` returned.
- The wallet session was not restored.
- The SIWS proof was not restored.
- `Wallet Control Verified` was absent.
- `Verified Seeker` was absent.

Stage 4 local loyalty data remained intact:

```text
13 Stamps
3 Places
40 SKR Earned
Seeker Coffee 5/5
```

This confirms that wallet-control and derived verification state remain memory-only while the separate Stage 4 loyalty state persists as designed.

## Physical validation matrix

| Scenario                                                         | Result |
| ---------------------------------------------------------------- | ------ |
| Real official SGT detected                                       | PASS   |
| Verified Seeker absent before SIWS                               | PASS   |
| Explicit one-time SIWS message approval                          | PASS   |
| No transaction, movement, approval, recipient, or fee            | PASS   |
| Wallet Control Verified after valid SIWS                         | PASS   |
| Verified Seeker derived from matching SGT and SIWS state         | PASS   |
| Five-minute proof expiry removes Verified Seeker                 | PASS   |
| Disconnect removes Verified Seeker                               | PASS   |
| Same-address reconnect rejects old proof                         | PASS   |
| Temporary SGT query failure remains inconclusive and fail-closed | PASS   |
| Subsequent reconnect redetects the official SGT                  | PASS   |
| App restart clears wallet, SIWS, and derived verification state  | PASS   |
| App restart preserves Stage 4 loyalty state                      | PASS   |

## Automated regression validation

| Check                            | Result         |
| -------------------------------- | -------------- |
| Stage 5B.4 Verified Seeker tests | PASS — 20/20   |
| Stage 5B.3 SIWS tests            | PASS — 80/80   |
| Stage 5A SGT tests               | PASS — 9/9     |
| Stage 4 QR tests                 | PASS — 13/13   |
| Automated feature-test total     | PASS — 122/122 |
| TypeScript                       | PASS           |
| ESLint                           | PASS           |
| Prettier                         | PASS           |
| Expo Doctor                      | PASS — 21/21   |
| MWA sensitive-logging verifier   | PASS           |
| `git diff --check`               | PASS           |

## Security boundary

The implementation boundary is unchanged:

| Capability or state               | Status |
| --------------------------------- | ------ |
| Transaction signing               | ABSENT |
| Transaction submission            | ABSENT |
| SOL, SPL, or SKR fund movement    | ABSENT |
| Token approvals                   | ABSENT |
| SKR claim                         | ABSENT |
| SIWS proof persistence            | ABSENT |
| Verified Seeker persistence       | ABSENT |
| Seed phrase or private-key access | ABSENT |
| Runtime fake SGT override         | ABSENT |

The only wallet signature used in this validation was the existing, explicitly approved SIWS identity message. It was not a transaction and moved no funds.

## Remaining limitations

1. **OPEN BLOCKER — Phantom identity interoperability.** Phantom's identity warning remains unresolved. Never authorize while the warning is visible.
2. **KNOWN LIMITATION — Solflare SIWS cancellation classification.** When Solflare provides no primitive cancellation error code, Stampd retains the generic fail-closed `Unable to Verify Wallet Control` result. No broad message matching or cancellation mapping is justified.
3. General production exposure remains unapproved. This checkpoint records the real-SGT positive result only and is not a production seal.

## Checkpoint decision

The real official SGT-holder positive physical path is validated on the exact internal release-like APK. The derived status, expiry, disconnect isolation, same-address session isolation, restart cleanup, and loyalty-state preservation all passed without changing the product implementation.

**Real SGT-holder physical validation: PASS**

**Internal release-like exposure: PASS**

**General production exposure: NO**
