# Stampd demo runbook

This runbook is for the validated Stage 5B.4 internal release-like path. It does not authorize hidden test paths or change product state in code.

## Artifact status

### Historical validated APK

- EAS Build ID: `6c175360-4cb3-4425-9d43-fce13999d3a0`
- APK SHA-256: `1F26304D41DFF0AE173874C1D767EAACB466FEC0C777C5DA7F2FC8F6836B76A2`
- Package: `com.stampd.app`
- Historical wallet coverage: Solflare authorization/SIWS and Seed Vault real-SGT positive validation

This historical APK predates Demo Readiness Batch 1. Its hash remains physical-validation evidence for the underlying Stage 5B.4 flow; it does not identify an APK containing the Batch 1 presentation changes.

### Polished Batch 1 APK

- Status: **PRE-INSTALL AUDIT PASS / PHYSICAL DEMO VALIDATION PASS**
- EAS Build ID: `ad076376-9872-455b-b6c5-6441f8e699d2`
- APK SHA-256: `A0396BA43455BA1C041925699174D46C5CF2658D01E2CF7D747D73F9703128E4`
- Package: `com.stampd.app`
- Mode: internal, release-like, bundled JavaScript, non-debuggable, no Metro requirement
- Presentation scope: Demo Readiness Batch 1 + Batch 1.1

This artifact passed independent package, certificate, release-mode, bundled-JavaScript, App Link, product-copy, QR, and wallet-safety auditing before installation. It subsequently passed the polished physical judge flow. It is not approved as a general production release.

## Preflight checklist

1. Verify the polished APK SHA-256 against `A0396BA43455BA1C041925699174D46C5CF2658D01E2CF7D747D73F9703128E4` before installing it.
2. Clear Stampd app storage externally in Android: **Settings → Apps → Stampd → Storage & cache → Clear storage**. This erases the local demo stamp and returns Seeker Coffee to 4/5. Do not add or use a hidden in-app reset.
3. Open **Scan**, grant camera permission while the demo QR is out of view, confirm the camera opens, then return to Passport without scanning.
4. Confirm the clean starting state: **6 Stamps**, **2 Places**, **0 Eligible Programs**, and Seeker Coffee at **4 / 5 stamps**.
5. Return to the welcome screen and confirm Stampd is disconnected.
6. In the device's Seed Vault, preselect the real official SGT-holding account. Confirm only the expected shortened address (`fMKR...UE5X`); do not expose or copy its full address.
7. Verify internet access to `https://identity.stampdpass.com`, `https://sgt.stampdpass.com`, and `https://auth.stampdpass.com`.
8. Prepare the exact QR code below on a second device or a printed card, still out of camera view.
9. Keep one unedited backup recording of the same validated flow available. Label it as a recording; never present it as a live result.

Never use a seed phrase, private key, wallet export, authorization token, raw signature, challenge nonce, or sensitive association URL during preparation.

## Exact QR payload

```text
{"v":1,"type":"stampd_demo_stamp","merchantId":"seeker-coffee","stampId":"seeker-coffee-demo-5"}
```

Generate the QR from that exact compact string. Do not add keys, whitespace-dependent wrappers, URLs, or a different stamp ID.

## Three-minute flow

| Time      | Action                                                                                            | Expected result                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:20 | Open Stampd and enter the passport                                                                | `6 Stamps`, `2 Places`, `0 Eligible Programs`, and Seeker Coffee `4/5` are visible                                                                           |
| 0:20–0:50 | Tap Connect Wallet, read the safety sheet, continue, and select Seed Vault                        | Stampd connects to the preselected account; only the shortened public address is displayed                                                                   |
| 0:50–1:15 | Wait for the read-only SGT check                                                                  | `SGT Detected` appears; `Verified Seeker` is still absent                                                                                                    |
| 1:15–1:50 | Tap Verify Wallet Control, read the SIWS safety sheet, continue, and approve the identity message | The wallet shows message signing only; no transaction, recipient, amount, approval, or fee                                                                   |
| 1:50–2:10 | Return to Stampd                                                                                  | `Wallet Control Verified` and `Verified Seeker` appear alongside `SGT Detected`                                                                              |
| 2:10–2:35 | Open Scan and scan the exact prepared QR                                                          | One local Seeker Coffee stamp is collected and the app moves from `4/5` to `5/5`                                                                             |
| 2:35–3:00 | Present Stamp Success and stop the primary live demo                                              | `STAMP COLLECTED`, `DEMO ELIGIBILITY UNLOCKED`, `20 SKR DEMO REWARD TARGET`, `Eligibility Ready · Demo`, and the no-transfer/no-claim disclaimer are visible |

Do not return to Passport during the primary judge flow. Passport → Scan replaces and unmounts Passport, so its page-local wallet/SIWS state is discarded fail-closed. The disconnected state shown by a newly mounted Passport is not a security failure and is not presented as a production feature. Stamp Success already completes the validated product story.

## Stop conditions

Cancel immediately if any wallet screen shows:

- an identity-verification warning;
- a transaction or transaction simulation;
- a recipient, SOL amount, token amount, SKR amount, token approval, or network fee;
- an account other than the preselected official SGT holder.

Do not continue if Stampd reports `No SGT Detected` for the intended account or if the connected address changes.

## Safe fallback policy

- **Unable to Check:** treat it as a transient, inconclusive network/service result. Wait briefly, confirm connectivity, and reconnect once from a fresh session. Do not claim SGT detection or Verified Seeker. If it persists, show the clearly labeled unedited backup recording.
- **Duplicate QR:** this indicates the local stamp already exists. Stop; do not imply a second stamp was granted. Clear app storage externally and repeat the full preflight, or use the backup recording.
- **SIWS unable/cancelled:** do not claim Wallet Control or Verified Seeker. Retry manually only after checking the selected account and identity UI.
- **Phantom warning:** cancel. Do not ask a judge to ignore the warning, switch to Phantom because of a delay, or bypass wallet identity verification. Use the validated Seed Vault path or clearly labeled backup evidence.

There is no approved hidden debug path, fake SGT switch, production override, or in-app reset for the demo.

## Evidence to capture

- Welcome screen without personal data.
- Shortened connected address only.
- `SGT Detected` before Wallet Control.
- Wallet message-signing screen showing no transaction or fee, with sensitive fields excluded.
- `SGT Detected`, `Wallet Control Verified`, and `Verified Seeker` together.
- Scanner framing the prepared merchant QR.
- Stamp success at 5/5.
- Demo eligibility disclaimer and target label.

The validated polished physical result was: Seed Vault connection PASS, real SGT Detected PASS, SIWS PASS, Wallet Control Verified PASS, Verified Seeker PASS, QR scan PASS, `4/5 → 5/5` PASS, Demo Eligibility Unlocked PASS, reward truthfulness PASS, no Claim/Redeem PASS, and no wallet or transaction side effect from QR PASS.

Never capture a seed phrase, private key, recovery phrase, full wallet address, raw signature, authorization token, nonce, request ID, or sensitive Intent/association URL.
