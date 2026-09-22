import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'
import { parseChallengeResponse, parseSignInResult, parseVerifyResponse } from '../siwsTypes.ts'

const NOW = Date.parse('2026-09-20T00:01:00.000Z')
const ADDRESS = '11111111111111111111111111111111'
const OTHER_ADDRESS = 'SysvarRent111111111111111111111111111111111'
const ENCODED_ADDRESS = Buffer.alloc(32).toString('base64')
const MESSAGE = Buffer.from('identity.stampdpass.com wallet-control test').toString('base64')
const SIGNATURE = Buffer.alloc(64, 7).toString('base64')

function challengeResponse(changes = {}, outerChanges = {}) {
  return {
    schemaVersion: 1,
    status: 'issued',
    challenge: {
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
      ...changes,
    },
    ...outerChanges,
  }
}

function signInResult(changes = {}) {
  return {
    address: ENCODED_ADDRESS,
    signed_message: MESSAGE,
    signature: SIGNATURE,
    signature_type: 'ed25519',
    ...changes,
  }
}

function verifyResponse(changes = {}) {
  return {
    schemaVersion: 1,
    status: 'wallet_control_verified',
    address: ADDRESS,
    verifiedAt: '2026-09-20T00:01:00.000Z',
    proofExpiresAt: '2026-09-20T00:06:00.000Z',
    ...changes,
  }
}

test('valid 201 challenge shape is accepted', () => {
  assert.equal(parseChallengeResponse(challengeResponse(), ADDRESS, NOW)?.requestId.length, 32)
})

for (const [name, changes] of [
  ['wrong address', { address: OTHER_ADDRESS }],
  ['wrong domain', { domain: 'example.com' }],
  ['wrong URI', { uri: 'https://example.com' }],
  ['wrong statement', { statement: 'Sign something else.' }],
  ['wrong chainId', { chainId: 'solana:devnet' }],
  ['wrong version', { version: '2' }],
  ['malformed nonce', { nonce: 'ABC' }],
  ['malformed requestId', { requestId: 'not-hex' }],
  ['wrong TTL', { expirationTime: '2026-09-20T00:04:59.000Z' }],
  ['noncanonical issuedAt', { issuedAt: '2026-09-20T00:00:00Z' }],
]) {
  test(`${name} challenge is rejected`, () => {
    assert.equal(parseChallengeResponse(challengeResponse(changes), ADDRESS, NOW), null)
  })
}

test('expired challenge is rejected', () => {
  assert.equal(parseChallengeResponse(challengeResponse(), ADDRESS, Date.parse('2026-09-20T00:05:00.000Z')), null)
})

test('unknown extra challenge property is rejected', () => {
  assert.equal(parseChallengeResponse(challengeResponse({ extra: true }), ADDRESS, NOW), null)
})

test('unknown outer challenge response property is rejected', () => {
  assert.equal(parseChallengeResponse(challengeResponse({}, { extra: true }), ADDRESS, NOW), null)
})

test('wrong challenge status is rejected', () => {
  assert.equal(parseChallengeResponse(challengeResponse({}, { status: 'unable' }), ADDRESS, NOW), null)
})

test('valid sign-in result is accepted and wallet bytes are preserved', () => {
  const result = parseSignInResult(signInResult(), [{ address: ENCODED_ADDRESS }], ADDRESS)
  assert.equal(result?.signedMessage, MESSAGE)
  assert.equal(result?.signature, SIGNATURE)
  assert.equal(result?.signatureType, 'ed25519')
})

test('omitted signature type uses the MWA Ed25519 default', () => {
  const value = signInResult()
  delete value.signature_type
  assert.equal(parseSignInResult(value, [{ address: ENCODED_ADDRESS }], ADDRESS)?.signatureType, 'ed25519')
})

test('missing sign-in result fails closed', () => {
  assert.equal(parseSignInResult(undefined, [{ address: ENCODED_ADDRESS }], ADDRESS), null)
})

test('malformed result address is rejected', () => {
  assert.equal(parseSignInResult(signInResult({ address: '***' }), [{ address: ENCODED_ADDRESS }], ADDRESS), null)
})

test('result address mismatch is rejected', () => {
  assert.equal(parseSignInResult(signInResult(), [{ address: ENCODED_ADDRESS }], OTHER_ADDRESS), null)
})

test('authorized account mismatch is rejected', () => {
  const otherEncoded = Buffer.from(new Uint8Array(32).fill(2)).toString('base64')
  assert.equal(parseSignInResult(signInResult(), [{ address: otherEncoded }], ADDRESS), null)
})

test('malformed signed message base64 is rejected', () => {
  assert.equal(
    parseSignInResult(signInResult({ signed_message: 'not_base64' }), [{ address: ENCODED_ADDRESS }], ADDRESS),
    null,
  )
})

test('malformed signature base64 is rejected', () => {
  assert.equal(parseSignInResult(signInResult({ signature: '---' }), [{ address: ENCODED_ADDRESS }], ADDRESS), null)
})

test('signature with wrong byte length is rejected', () => {
  const signature = Buffer.alloc(63).toString('base64')
  assert.equal(parseSignInResult(signInResult({ signature }), [{ address: ENCODED_ADDRESS }], ADDRESS), null)
})

test('unsupported signature type is rejected', () => {
  assert.equal(
    parseSignInResult(signInResult({ signature_type: 'secp256k1' }), [{ address: ENCODED_ADDRESS }], ADDRESS),
    null,
  )
})

test('extra sign-in result property is rejected', () => {
  assert.equal(parseSignInResult(signInResult({ extra: true }), [{ address: ENCODED_ADDRESS }], ADDRESS), null)
})

test('valid verify 200 shape is accepted', () => {
  assert.equal(parseVerifyResponse(verifyResponse(), ADDRESS, NOW)?.address, ADDRESS)
})

test('verify address mismatch is rejected', () => {
  assert.equal(parseVerifyResponse(verifyResponse({ address: OTHER_ADDRESS }), ADDRESS, NOW), null)
})

test('invalid proof TTL is rejected', () => {
  assert.equal(parseVerifyResponse(verifyResponse({ proofExpiresAt: '2026-09-20T00:05:59.000Z' }), ADDRESS, NOW), null)
})

test('expired proof is rejected', () => {
  assert.equal(parseVerifyResponse(verifyResponse(), ADDRESS, Date.parse('2026-09-20T00:06:00.000Z')), null)
})

test('Verified Seeker response is rejected', () => {
  assert.equal(parseVerifyResponse(verifyResponse({ status: 'verified_seeker' }), ADDRESS, NOW), null)
})

test('extra verify response property is rejected', () => {
  assert.equal(parseVerifyResponse(verifyResponse({ extra: true }), ADDRESS, NOW), null)
})

test('sign-in validation emits only safe symbolic branch diagnostics', () => {
  const diagnostics = []
  assert.equal(
    parseSignInResult(
      signInResult({ signature: Buffer.alloc(63).toString('base64') }),
      [{ address: ENCODED_ADDRESS }],
      ADDRESS,
      (breadcrumb) => diagnostics.push(breadcrumb),
    ),
    null,
  )
  assert.deepEqual(diagnostics, ['SIGN_IN_RESULT_INVALID_SIGNATURE_LENGTH'])
})
