import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const walletControlUrl = new URL('../WalletControl.tsx', import.meta.url)
const apiUrl = new URL('../siwsApi.ts', import.meta.url)
const diagnosticsUrl = new URL('../siwsDiagnostics.ts', import.meta.url)

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

test('wallet-control and derived Verified Seeker UI remain development-only', async () => {
  const source = await readFile(walletControlUrl, 'utf8')
  assert.match(source, /__DEV__ && verifiedSeeker &&/)
  assert.match(source, />Verified Seeker</)
  assert.match(source, />Wallet Control Verified</)
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
  assert.match(diagnosticSource, /MAX_VISIBLE_DIAGNOSTIC_BREADCRUMBS = 6/)
  assert.doesNotMatch(`${walletSource}\n${diagnosticSource}`, /console\.|AsyncStorage\.setItem|SecureStore/)
  assert.doesNotMatch(diagnosticSource, /SIGN_IN_RESULT_(?:NATIVE|FALLBACK)/)
})
