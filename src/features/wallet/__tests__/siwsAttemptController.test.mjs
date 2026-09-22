import assert from 'node:assert/strict'
import test from 'node:test'
import { createSiwsAttemptController } from '../siwsAttemptController.ts'

const ADDRESS = '11111111111111111111111111111111'
const OTHER_ADDRESS = 'SysvarRent111111111111111111111111111111111'
const NOW = Date.parse('2026-09-20T00:01:00.000Z')
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
const result = { address: ADDRESS, signedMessage: 'YQ==', signature: 'Yg==', signatureType: 'ed25519' }
const proof = {
  address: ADDRESS,
  verifiedAt: '2026-09-20T00:01:00.000Z',
  proofExpiresAt: '2026-09-20T00:06:00.000Z',
}

function harness(overrides = {}) {
  let address = ADDRESS
  let currentNow = NOW
  const calls = { challenge: 0, authorize: 0, verify: 0 }
  const states = []
  const proofs = []
  const diagnostics = []
  const options = {
    getCurrentAddress: () => address,
    requestChallenge: async () => {
      calls.challenge += 1
      return challenge
    },
    authorize: async () => {
      calls.authorize += 1
      return result
    },
    verify: async () => {
      calls.verify += 1
      return proof
    },
    classifyError: (error) => (error?.code === 'ERROR_ASSOCIATION_CANCELLED' ? 'cancelled' : 'unable'),
    getSafeErrorCode: (error) => error?.code ?? 'FAILED',
    onStateChange: (state) => states.push(state),
    onProofChange: (value) => proofs.push(value),
    onDiagnostic: (breadcrumb) => diagnostics.push(breadcrumb),
    onDiagnosticsReset: () => diagnostics.splice(0),
    now: () => currentNow,
    ...overrides,
  }
  const controller = createSiwsAttemptController(options)
  return {
    controller,
    calls,
    states,
    proofs,
    diagnostics,
    setAddress: (value) => (address = value),
    setNow: (value) => (currentNow = value),
  }
}

test('safety sheet Cancel sends zero HTTP or wallet requests', () => {
  const h = harness()
  h.controller.requestVerification()
  h.controller.cancelSafety()
  assert.deepEqual(h.calls, { challenge: 0, authorize: 0, verify: 0 })
  assert.equal(h.states.at(-1).status, 'cancelled')
})

test('challenge is not requested until explicit Continue', () => {
  const h = harness()
  h.controller.requestVerification()
  assert.equal(h.calls.challenge, 0)
})

test('Continue without safety consent is ignored', async () => {
  const h = harness()
  await h.controller.continueVerification()
  assert.deepEqual(h.calls, { challenge: 0, authorize: 0, verify: 0 })
})

test('valid flow invokes MWA once and verifies once', async () => {
  const h = harness()
  h.controller.requestVerification()
  await h.controller.continueVerification()
  assert.deepEqual(h.calls, { challenge: 1, authorize: 1, verify: 1 })
  assert.equal(h.states.at(-1).status, 'verified')
  assert.deepEqual(h.proofs.at(-1), proof)
})

test('duplicate Continue cannot create two wallet prompts', async () => {
  const pending = deferred()
  const h = harness({
    requestChallenge: async () => {
      h.calls.challenge += 1
      return pending.promise
    },
  })
  h.controller.requestVerification()
  const first = h.controller.continueVerification()
  const second = h.controller.continueVerification()
  assert.equal(h.calls.challenge, 1)
  pending.resolve(challenge)
  await Promise.all([first, second])
  assert.equal(h.calls.authorize, 1)
})

test('disconnect invalidates pending challenge response', async () => {
  const pending = deferred()
  const h = harness({ requestChallenge: () => pending.promise })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  h.controller.invalidate()
  pending.resolve(challenge)
  await run
  assert.equal(h.calls.authorize, 0)
})

test('disconnect invalidates wallet result', async () => {
  const pending = deferred()
  const h = harness({
    authorize: () => {
      h.calls.authorize += 1
      return pending.promise
    },
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.controller.invalidate()
  pending.resolve(result)
  await run
  assert.equal(h.calls.verify, 0)
})

test('disconnect invalidates verify response', async () => {
  const pending = deferred()
  const h = harness({
    verify: () => {
      h.calls.verify += 1
      return pending.promise
    },
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.controller.invalidate()
  pending.resolve(proof)
  await run
  assert.notEqual(h.states.at(-1)?.status, 'verified')
})

test('address switch invalidates pending attempt', async () => {
  const pending = deferred()
  const h = harness({ requestChallenge: () => pending.promise })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  h.setAddress(OTHER_ADDRESS)
  pending.resolve(challenge)
  await run
  assert.equal(h.calls.authorize, 0)
})

test('newer attempt invalidates older responses', async () => {
  const pending = deferred()
  const h = harness({ requestChallenge: () => pending.promise })
  h.controller.requestVerification()
  const oldRun = h.controller.continueVerification()
  h.controller.invalidate()
  h.controller.requestVerification()
  pending.resolve(challenge)
  await oldRun
  assert.equal(h.calls.authorize, 0)
})

test('wallet cancellation sends no verify request and remains neutral', async () => {
  const error = Object.assign(new Error('cancelled'), { code: 'ERROR_ASSOCIATION_CANCELLED' })
  const h = harness({ authorize: async () => Promise.reject(error) })
  h.controller.requestVerification()
  await h.controller.continueVerification()
  assert.equal(h.calls.verify, 0)
  assert.equal(h.states.at(-1).status, 'cancelled')
})

test('wallet declining message signing is treated as cancellation', async () => {
  const error = Object.assign(new Error('not signed'), { code: -3 })
  const h = harness({
    classifyError: (value) => (value?.code === -3 ? 'cancelled' : 'unable'),
    authorize: async () => Promise.reject(error),
  })
  h.controller.requestVerification()
  await h.controller.continueVerification()
  assert.equal(h.calls.verify, 0)
  assert.equal(h.states.at(-1).status, 'cancelled')
})

test('ordinary failure becomes unable', async () => {
  const h = harness({
    requestChallenge: async () => Promise.reject(Object.assign(new Error(), { code: 'NETWORK_FAILED' })),
  })
  h.controller.requestVerification()
  await h.controller.continueVerification()
  assert.deepEqual(h.states.at(-1), { status: 'unable', code: 'NETWORK_FAILED' })
})

test('no connected address prevents safety and signing flow', async () => {
  const h = harness({ getCurrentAddress: () => null })
  assert.equal(h.controller.requestVerification(), false)
  await h.controller.continueVerification()
  assert.deepEqual(h.calls, { challenge: 0, authorize: 0, verify: 0 })
})

test('proof clears on disconnect invalidation', async () => {
  const h = harness()
  h.controller.requestVerification()
  await h.controller.continueVerification()
  h.controller.invalidate()
  assert.equal(h.proofs.at(-1), null)
})

test('proof clears when an address change invalidates the session', async () => {
  const h = harness()
  h.controller.requestVerification()
  await h.controller.continueVerification()
  h.setAddress(OTHER_ADDRESS)
  h.controller.invalidate()
  assert.equal(h.proofs.at(-1), null)
})

test('proof expires from memory after its expiry time', async () => {
  const expiringProof = {
    ...proof,
    proofExpiresAt: new Date(NOW + 5).toISOString(),
  }
  const h = harness({ verify: async () => expiringProof })
  h.controller.requestVerification()
  await h.controller.continueVerification()
  assert.deepEqual(h.proofs.at(-1), expiringProof)
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(h.proofs.at(-1), null)
  assert.equal(h.states.at(-1).status, 'idle')
})

test('challenge expiry while wallet is open resets to a retryable fail-closed state', async () => {
  const pendingWallet = deferred()
  const scheduler = fakeScheduler()
  const h = harness({
    authorize: () => {
      h.calls.authorize += 1
      return pendingWallet.promise
    },
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.setNow(Date.parse(challenge.expirationTime))
  scheduler.fire(1)
  assert.deepEqual(h.states.at(-1), { status: 'unable', code: 'CHALLENGE_EXPIRED' })
  assert.equal(h.controller.hasActiveAttempt(), false)
  assert.equal(h.diagnostics.at(-1), 'CHALLENGE_EXPIRED')
  pendingWallet.resolve(result)
  await run
  assert.equal(h.calls.verify, 0)
})

test('challenge expiry while verify is pending aborts and resets the attempt', async () => {
  const pendingVerify = deferred()
  const scheduler = fakeScheduler()
  const h = harness({
    verify: () => {
      h.calls.verify += 1
      return pendingVerify.promise
    },
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.setNow(Date.parse(challenge.expirationTime))
  scheduler.fire(1)
  assert.deepEqual(h.states.at(-1), { status: 'unable', code: 'CHALLENGE_EXPIRED' })
  assert.equal(h.controller.hasActiveAttempt(), false)
  pendingVerify.resolve(proof)
  await run
  assert.notEqual(h.states.at(-1)?.status, 'verified')
})

test('late wallet response after challenge expiry cannot reach verify', async () => {
  const pendingWallet = deferred()
  const scheduler = fakeScheduler()
  const h = harness({
    authorize: () => pendingWallet.promise,
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.setNow(Date.parse(challenge.expirationTime))
  scheduler.fire(1)
  pendingWallet.resolve(result)
  await run
  assert.equal(h.calls.verify, 0)
  assert.equal(
    h.proofs.some((value) => value !== null),
    false,
  )
})

test('late verify response after challenge expiry cannot create proof', async () => {
  const pendingVerify = deferred()
  const scheduler = fakeScheduler()
  const h = harness({
    verify: () => pendingVerify.promise,
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.setNow(Date.parse(challenge.expirationTime))
  scheduler.fire(1)
  pendingVerify.resolve(proof)
  await run
  assert.equal(
    h.proofs.some((value) => value !== null),
    false,
  )
  assert.notEqual(h.states.at(-1)?.status, 'verified')
})

test('a new verification attempt succeeds after the previous challenge expires', async () => {
  const firstWallet = deferred()
  const scheduler = fakeScheduler()
  let authorizeCount = 0
  const h = harness({
    authorize: async () => {
      authorizeCount += 1
      return authorizeCount === 1 ? firstWallet.promise : result
    },
    requestChallenge: async () => ({
      ...challenge,
      expirationTime: new Date(authorizeCount > 0 ? NOW + 600_000 : NOW + 1_000).toISOString(),
    }),
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const firstRun = h.controller.continueVerification()
  await settle()
  h.setNow(NOW + 1_000)
  scheduler.fire(1)
  assert.equal(h.controller.requestVerification(), true)
  const secondRun = h.controller.continueVerification()
  await secondRun
  assert.equal(h.states.at(-1)?.status, 'verified')
  firstWallet.resolve(result)
  await firstRun
})

test('an old expiry callback cannot invalidate a newer attempt', async () => {
  const firstWallet = deferred()
  const secondWallet = deferred()
  const scheduler = fakeScheduler()
  let challengeCount = 0
  let authorizeCount = 0
  const h = harness({
    requestChallenge: async () => ({
      ...challenge,
      expirationTime: new Date(NOW + (++challengeCount === 1 ? 1_000 : 10_000)).toISOString(),
    }),
    authorize: () => (++authorizeCount === 1 ? firstWallet.promise : secondWallet.promise),
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const firstRun = h.controller.continueVerification()
  await settle()
  h.controller.invalidate()
  h.controller.requestVerification()
  const secondRun = h.controller.continueVerification()
  await settle()
  h.setNow(NOW + 1_000)
  scheduler.fire(1, true)
  assert.equal(h.controller.hasActiveAttempt(), true)
  assert.equal(h.states.at(-1)?.status, 'opening_wallet')
  secondWallet.resolve(result)
  await secondRun
  assert.equal(h.states.at(-1)?.status, 'verified')
  firstWallet.resolve(result)
  await firstRun
})

test('disconnect before expiry prevents the timer from changing state', async () => {
  const pendingWallet = deferred()
  const scheduler = fakeScheduler()
  const h = harness({
    authorize: () => pendingWallet.promise,
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.controller.invalidate()
  const stateAfterDisconnect = h.states.at(-1)
  scheduler.fire(1, true)
  assert.deepEqual(h.states.at(-1), stateAfterDisconnect)
  assert.equal(h.controller.hasActiveAttempt(), false)
  pendingWallet.resolve(result)
  await run
})

test('unmount invalidation before expiry prevents late timer and wallet updates', async () => {
  const pendingWallet = deferred()
  const scheduler = fakeScheduler()
  const h = harness({
    authorize: () => pendingWallet.promise,
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.controller.invalidate(false, false)
  const stateAtUnmount = h.states.at(-1)
  scheduler.fire(1, true)
  pendingWallet.resolve(result)
  await run
  assert.deepEqual(h.states.at(-1), stateAtUnmount)
  assert.equal(h.calls.verify, 0)
})

test('address and session replacement before expiry invalidates the old attempt', async () => {
  const pendingWallet = deferred()
  const scheduler = fakeScheduler()
  const h = harness({
    authorize: () => pendingWallet.promise,
    scheduleTimer: scheduler.schedule,
    cancelTimer: scheduler.cancel,
  })
  h.controller.requestVerification()
  const run = h.controller.continueVerification()
  await settle()
  h.setAddress(OTHER_ADDRESS)
  h.controller.invalidate()
  scheduler.fire(1, true)
  pendingWallet.resolve(result)
  await run
  assert.equal(h.controller.hasActiveAttempt(), false)
  assert.equal(h.calls.verify, 0)
  assert.equal(
    h.proofs.some((value) => value !== null),
    false,
  )
})

test('app initialization does not restore proof', () => {
  const h = harness()
  assert.deepEqual(h.proofs, [])
  assert.equal(h.states.length, 0)
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function fakeScheduler() {
  let nextHandle = 0
  const timers = new Map()
  return {
    schedule(callback) {
      const handle = ++nextHandle
      timers.set(handle, { callback, cancelled: false })
      return handle
    },
    cancel(handle) {
      const timer = timers.get(handle)
      if (timer) timer.cancelled = true
    },
    fire(handle, includeCancelled = false) {
      const timer = timers.get(handle)
      if (timer && (includeCancelled || !timer.cancelled)) timer.callback()
    },
  }
}
