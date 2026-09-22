import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createChallengeRequestBody, createVerifyRequestBody } from '../siwsTypes.ts'

const ADDRESS = '11111111111111111111111111111111'
const challenge = {
  domain: 'identity.stampdpass.com',
  address: ADDRESS,
  statement: 'Sign in to Stampd to verify control of this wallet for Seeker status.',
  uri: 'https://identity.stampdpass.com',
  version: '1',
  chainId: 'solana:mainnet',
  nonce: '0123456789abcdef0123456789abcdef',
  issuedAt: '2026-09-20T00:00:00.000Z',
  expirationTime: '2026-09-20T00:05:00.000Z',
  requestId: 'fedcba9876543210fedcba9876543210',
}
const apiUrl = new URL('../siwsApi.ts', import.meta.url)

test('challenge API body contains exactly the captured wallet address', () => {
  assert.deepEqual(createChallengeRequestBody(ADDRESS), { walletAddress: ADDRESS })
})

test('verify request preserves exact wallet-returned message and signature', () => {
  const signedMessage = Buffer.from('wallet bytes').toString('base64')
  const signature = Buffer.alloc(64, 9).toString('base64')
  assert.deepEqual(
    createVerifyRequestBody(ADDRESS, challenge, {
      address: ADDRESS,
      signedMessage,
      signature,
      signatureType: 'ed25519',
    }),
    {
      requestId: challenge.requestId,
      address: ADDRESS,
      signedMessage,
      signature,
      signatureType: 'ed25519',
    },
  )
})

test('API uses only the fixed Stampd challenge and verify endpoints', async () => {
  const source = await readFile(apiUrl, 'utf8')
  assert.match(source, /https:\/\/auth\.stampdpass\.com/)
  assert.match(source, /\/v1\/siws\/challenge/)
  assert.match(source, /\/v1\/siws\/verify/)
})

test('API requires challenge 201 and verify 200', async () => {
  const source = await readFile(apiUrl, 'utf8')
  assert.match(source, /response\.status !== 201/)
  assert.match(source, /response\.status !== 200/)
})

test('API contains no sensitive logging', async () => {
  const source = await readFile(apiUrl, 'utf8')
  assert.doesNotMatch(source, /console\.|auth_token|Authorization:/)
})

test('challenge request has a conservative 30-second fail-closed timeout', async () => {
  const source = await readFile(apiUrl, 'utf8')
  assert.match(source, /SIWS_NETWORK_TIMEOUT_MS = 30_000/)
  assert.match(source, /'CHALLENGE_TIMEOUT'/)
  assert.match(source, /controller\.abort\(\)/)
})

test('verify request has a conservative 30-second fail-closed timeout', async () => {
  const source = await readFile(apiUrl, 'utf8')
  assert.match(source, /'VERIFY_REQUEST_SENT'/)
  assert.match(source, /'VERIFY_TIMEOUT'/)
  assert.match(source, /throw new SiwsApiError\(timeoutCode\)/)
})
