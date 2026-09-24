import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const walletControlUrl = new URL('../WalletControl.tsx', import.meta.url)
const apiUrl = new URL('../siwsApi.ts', import.meta.url)
const diagnosticsUrl = new URL('../siwsDiagnostics.ts', import.meta.url)
const productGateUrl = new URL('../productGate.ts', import.meta.url)
const passportUrl = new URL('../../../../app/passport.tsx', import.meta.url)

test('application has no manual signMessages fallback', async () => {
  const source = await readFile(walletControlUrl, 'utf8')
  assert.doesNotMatch(source, /\.signMessages\s*\(/)
  assert.doesNotMatch(source, /sign_messages/)
})

test('wallet-control source calls no transaction or transfer API', async () => {
  const source = await readFile(walletControlUrl, 'utf8')
  assert.doesNotMatch(source, /\.(?:signTransaction|signAndSendTransaction|sendTransaction)\s*\(/)
  assert.doesNotMatch(source, /SystemProgram\.transfer|createTransferInstruction/)
})

test('proof and signing material are not persisted', async () => {
  const source = `${await readFile(walletControlUrl, 'utf8')}\n${await readFile(apiUrl, 'utf8')}`
  assert.doesNotMatch(source, /AsyncStorage\.(?:setItem|multiSet)/)
  assert.doesNotMatch(source, /SecureStore|Bearer |JWT/)
})

test('wallet-control and derived Verified Seeker UI use the internal product gate', async () => {
  const source = await readFile(walletControlUrl, 'utf8')
  assert.match(source, /WALLET_CONTROL_PRODUCT_ENABLED && \(/)
  assert.match(source, /WALLET_CONTROL_PRODUCT_ENABLED && verifiedSeeker &&/)
  assert.match(source, />Verified Seeker</)
  assert.match(source, />Wallet Control Verified</)
})

test('internal product gate is visibility-only and defaults to false outside development', async () => {
  const gateSource = await readFile(productGateUrl, 'utf8')
  const walletSource = await readFile(walletControlUrl, 'utf8')
  const selectorSource = await readFile(new URL('../../seeker/verifiedSeeker.ts', import.meta.url), 'utf8')

  assert.match(gateSource, /isDevelopmentBuild \|\| internalIdentityPreviewFlag === 'true'/)
  assert.match(gateSource, /process\.env\.EXPO_PUBLIC_INTERNAL_IDENTITY_PREVIEW_ENABLED/)
  assert.doesNotMatch(gateSource, /walletControlProof|isVerifiedSeeker|sgtState|sessionEpoch|expiresAt/)
  assert.doesNotMatch(selectorSource, /WALLET_CONTROL_PRODUCT_ENABLED|INTERNAL_IDENTITY_PREVIEW/)
  assert.equal(walletSource.match(/WALLET_CONTROL_PRODUCT_ENABLED/g)?.length, 3)
})

test('SIWS flow keeps devnet authorization and server challenge payload', async () => {
  const source = await readFile(walletControlUrl, 'utf8')
  assert.match(source, /chain: walletConfig\.chain/)
  assert.match(source, /sign_in_payload: challenge/)
})

test('diagnostics are development-only, bounded, symbolic, and memory-only', async () => {
  const walletSource = await readFile(walletControlUrl, 'utf8')
  const diagnosticSource = await readFile(diagnosticsUrl, 'utf8')
  assert.match(walletSource, /const diagnostic = __DEV__ \? recordDevDiagnostic : undefined/)
  assert.match(walletSource, /__DEV__ && devDiagnostics\.length > 0/)
  assert.match(walletSource, /__DEV__ && props\.state\.status === 'unable' && props\.diagnostics\.length > 0/)
  assert.match(diagnosticSource, /MAX_VISIBLE_DIAGNOSTIC_BREADCRUMBS = 6/)
  assert.doesNotMatch(`${walletSource}\n${diagnosticSource}`, /console\.|AsyncStorage\.setItem|SecureStore/)
  assert.doesNotMatch(diagnosticSource, /SIGN_IN_RESULT_(?:NATIVE|FALLBACK)/)
})

test('Stage 4 reset controls remain explicitly development-only', async () => {
  const source = await readFile(passportUrl, 'utf8')
  assert.match(source, /__DEV__ && \([\s\S]*Reset Seeker Coffee Demo/)
  assert.match(source, /__DEV__ && resetMessage/)
})

test('internal release-like copy documents consent, networks, expiry, and identity warning', async () => {
  const source = await readFile(walletControlUrl, 'utf8')
  assert.match(source, /Wallet Control Verification/)
  assert.match(source, /one-time identity message/)
  assert.match(source, /This is not a transaction/)
  assert.match(source, /No SOL, tokens, or SKR will move/)
  assert.match(source, /No token approval will be requested/)
  assert.match(source, /There is no network fee/)
  assert.match(source, /Verification expires in five minutes/)
  assert.match(source, /checked read-only on Solana mainnet/)
  assert.match(source, /wallet connection remains on devnet/)
  assert.match(source, /select the wallet already connected to Stampd/)
  assert.match(source, /identity cannot be verified, cancel/)
  assert.doesNotMatch(source, /Development diagnostic/)
})
