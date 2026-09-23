import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createSgtRequestController } from '../../seeker/sgtRequestController.ts'
import { isVerifiedSeeker } from '../../seeker/verifiedSeeker.ts'

const ADDRESS_A = 'wallet-a'
const ADDRESS_B = 'wallet-b'
const NOW = Date.parse('2026-09-23T00:00:00.000Z')
const EXPIRES_AT = '2026-09-23T00:05:00.000Z'
const proof = {
  address: ADDRESS_A,
  verifiedAt: '2026-09-23T00:00:00.000Z',
  proofExpiresAt: EXPIRES_AT,
}
const detected = { status: 'detected', address: ADDRESS_A }
const validInputs = {
  connectedAddress: ADDRESS_A,
  sessionAddress: ADDRESS_A,
  sessionEpoch: 2,
  sgtState: detected,
  siwsState: { status: 'verified' },
  siwsProof: proof,
  proofSessionEpoch: 2,
  nowMs: NOW,
}

function derive(overrides = {}) {
  return isVerifiedSeeker({ ...validInputs, ...overrides })
}

test('same current address, detected SGT, verified SIWS, and unexpired proof derive true', () => {
  assert.equal(derive(), true)
})

test('no wallet or no current session derives false', () => {
  assert.equal(derive({ connectedAddress: null }), false)
  assert.equal(derive({ sessionAddress: null }), false)
  assert.equal(derive({ sessionEpoch: 0 }), false)
})

test('displayed address must match current session address', () => {
  assert.equal(derive({ connectedAddress: ADDRESS_B }), false)
  assert.equal(derive({ sessionAddress: ADDRESS_B }), false)
})

test('SGT checking, not_detected, unable, or idle derives false', () => {
  for (const status of ['checking', 'not_detected', 'unable']) {
    assert.equal(derive({ sgtState: { status, address: ADDRESS_A } }), false)
  }
  assert.equal(derive({ sgtState: { status: 'idle' } }), false)
})

test('old Wallet A detected state cannot verify connected Wallet B during a render', () => {
  assert.equal(
    derive({
      connectedAddress: ADDRESS_B,
      sessionAddress: ADDRESS_B,
      sgtState: { status: 'detected', address: ADDRESS_A },
      siwsProof: { ...proof, address: ADDRESS_B },
    }),
    false,
  )
})

test('a detected SGT result without its captured address fails closed', () => {
  assert.equal(derive({ sgtState: { status: 'detected' } }), false)
})

test('missing SIWS proof or nonverified SIWS state derives false', () => {
  assert.equal(derive({ siwsProof: null }), false)
  for (const status of ['idle', 'safety', 'requesting_challenge', 'opening_wallet', 'verifying', 'cancelled']) {
    assert.equal(derive({ siwsState: { status } }), false)
  }
  assert.equal(derive({ siwsState: { status: 'unable', code: 'VERIFICATION_FAILED' } }), false)
})

test('SIWS proof for a different address derives false', () => {
  assert.equal(derive({ siwsProof: { ...proof, address: ADDRESS_B } }), false)
})

test('expired proof and proof expiring exactly now derive false', () => {
  const expiry = Date.parse(EXPIRES_AT)
  assert.equal(derive({ nowMs: expiry }), false)
  assert.equal(derive({ nowMs: expiry + 1 }), false)
  assert.equal(derive({ nowMs: expiry - 1 }), true)
})

test('malformed or noncanonical proof expiry and invalid current time derive false', () => {
  assert.equal(derive({ siwsProof: { ...proof, proofExpiresAt: 'not-a-date' } }), false)
  assert.equal(derive({ siwsProof: { ...proof, proofExpiresAt: '2026-09-23' } }), false)
  assert.equal(derive({ siwsProof: { ...proof, proofExpiresAt: null } }), false)
  assert.equal(derive({ nowMs: Number.NaN }), false)
})

test('disconnect and restart-equivalent cleared state derive false', () => {
  assert.equal(derive({ connectedAddress: null, sessionAddress: null, siwsProof: null }), false)
  assert.equal(
    derive({
      connectedAddress: null,
      sessionAddress: null,
      sessionEpoch: 0,
      sgtState: { status: 'idle' },
      siwsState: { status: 'idle' },
      siwsProof: null,
      proofSessionEpoch: null,
    }),
    false,
  )
})

test('same-address new session rejects an old session proof', () => {
  assert.equal(derive({ sessionEpoch: 3, proofSessionEpoch: 2 }), false)
  assert.equal(derive({ proofSessionEpoch: null }), false)
})

test('SGT refresh and detected-to-failure transitions remove a previous positive', () => {
  assert.equal(derive(), true)
  assert.equal(derive({ sgtState: { status: 'checking', address: ADDRESS_A } }), false)
  assert.equal(derive({ sgtState: { status: 'unable', address: ADDRESS_A } }), false)
  assert.equal(derive({ sgtState: { status: 'not_detected', address: ADDRESS_A } }), false)
})

test('late SIWS completion and simultaneous SGT/SIWS refresh fail closed', () => {
  assert.equal(derive({ siwsState: { status: 'idle' }, siwsProof: proof }), false)
  assert.equal(derive({ sessionEpoch: 3, proofSessionEpoch: 2, siwsState: { status: 'verified' } }), false)
  assert.equal(
    derive({ sgtState: { status: 'checking', address: ADDRESS_A }, siwsState: { status: 'verifying' } }),
    false,
  )
})

test('foreground time recheck rejects a proof that expired while the app was away', () => {
  assert.equal(derive({ nowMs: NOW }), true)
  assert.equal(derive({ nowMs: Date.parse(EXPIRES_AT) + 60_000 }), false)
})

test('SGT controller binds checking and accepted result to the captured request address', async () => {
  const states = []
  const controller = createSgtRequestController({
    check: async () => ({ status: 'detected' }),
    timeoutMs: 1_000,
    onStateChange: (state) => states.push(state),
  })

  controller.start(ADDRESS_A)
  await settle()
  assert.deepEqual(states, [
    { status: 'checking', address: ADDRESS_A },
    { status: 'detected', address: ADDRESS_A },
  ])
})

test('old SGT response cannot overwrite a new address after a switch', async () => {
  const resolvers = []
  const states = []
  const controller = createSgtRequestController({
    check: () => new Promise((resolve) => resolvers.push(resolve)),
    timeoutMs: 1_000,
    onStateChange: (state) => states.push(state),
  })

  controller.start(ADDRESS_A)
  controller.start(ADDRESS_B)
  resolvers[0]({ status: 'detected' })
  await settle()
  assert.deepEqual(states, [
    { status: 'checking', address: ADDRESS_A },
    { status: 'checking', address: ADDRESS_B },
  ])
  resolvers[1]({ status: 'not_detected' })
  await settle()
  assert.deepEqual(states.at(-1), { status: 'not_detected', address: ADDRESS_B })
})

test('SGT refresh clears a prior detected state before its next response', async () => {
  const resolvers = []
  const states = []
  const controller = createSgtRequestController({
    check: () => new Promise((resolve) => resolvers.push(resolve)),
    timeoutMs: 1_000,
    onStateChange: (state) => states.push(state),
  })

  controller.start(ADDRESS_A)
  resolvers[0]({ status: 'detected' })
  await settle()
  assert.equal(derive({ sgtState: states.at(-1) }), true)
  controller.start(ADDRESS_A)
  assert.deepEqual(states.at(-1), { status: 'checking', address: ADDRESS_A })
  assert.equal(derive({ sgtState: states.at(-1) }), false)
  resolvers[1]({ status: 'unable' })
  await settle()
  assert.equal(derive({ sgtState: states.at(-1) }), false)
})

test('SGT network failure remains address-bound and unable', async () => {
  const states = []
  const controller = createSgtRequestController({
    check: async () => {
      throw new Error('network unavailable')
    },
    timeoutMs: 1_000,
    onStateChange: (state) => states.push(state),
  })
  controller.start(ADDRESS_A)
  await settle()
  assert.deepEqual(states.at(-1), { status: 'unable', address: ADDRESS_A })
  assert.equal(derive({ sgtState: states.at(-1) }), false)
})

test('source keeps Verified Seeker derived, memory-only, DEV-gated, and non-transactional', async () => {
  const walletSource = await readFile(new URL('../../wallet/WalletControl.tsx', import.meta.url), 'utf8')
  const selectorSource = await readFile(new URL('../../seeker/verifiedSeeker.ts', import.meta.url), 'utf8')
  const sgtSource = await readFile(new URL('../../seeker/sgtRequestController.ts', import.meta.url), 'utf8')
  const source = `${walletSource}\n${selectorSource}\n${sgtSource}`

  assert.match(walletSource, /const verifiedSeeker = isVerifiedSeeker\(/)
  assert.match(walletSource, /__DEV__ && verifiedSeeker &&/)
  assert.match(walletSource, /AppState\.addEventListener\('change'/)
  assert.doesNotMatch(source, /useState\s*\(\s*(?:true|false)\s*\).*verifiedSeeker/i)
  assert.doesNotMatch(source, /AsyncStorage\.(?:setItem|multiSet)|SecureStore/)
  assert.doesNotMatch(source, /\.(?:signTransaction|signAndSendTransaction|sendTransaction|sendRawTransaction)\s*\(/)
  assert.doesNotMatch(source, /SystemProgram\.transfer|createTransferInstruction|claimSkr|fakeSgt|sgtOverride/i)
})

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
