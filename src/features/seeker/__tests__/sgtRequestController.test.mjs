import assert from 'node:assert/strict'
import test from 'node:test'
import { createSgtRequestController } from '../sgtRequestController.ts'

const detected = {
  schemaVersion: 1,
  status: 'detected',
  network: 'solana:mainnet',
  sgtMintAddresses: ['11111111111111111111111111111111'],
  observedSlot: 1,
  checkedAt: '2026-09-17T04:00:00.000Z',
}

test('no wallet makes no request and remains idle', () => {
  let calls = 0
  const states = []
  const controller = createSgtRequestController({
    check: async () => {
      calls += 1
      return detected
    },
    timeoutMs: 100,
    onStateChange: (state) => states.push(state.status),
  })

  controller.start(null)
  assert.equal(calls, 0)
  assert.deepEqual(states, ['idle'])
})

test('connected wallet performs one lookup and reaches detected', async () => {
  let calls = 0
  const states = []
  const controller = createSgtRequestController({
    check: async () => {
      calls += 1
      return detected
    },
    timeoutMs: 100,
    onStateChange: (state) => states.push(state.status),
  })

  controller.start('wallet-one')
  await settle()
  assert.equal(calls, 1)
  assert.deepEqual(states, ['checking', 'detected'])
})

test('disconnect aborts the request and ignores its late result', async () => {
  let resolveRequest
  const states = []
  const controller = createSgtRequestController({
    check: () => new Promise((resolve) => (resolveRequest = resolve)),
    timeoutMs: 1_000,
    onStateChange: (state) => states.push(state.status),
  })

  const disconnect = controller.start('wallet-one')
  disconnect()
  resolveRequest(detected)
  await settle()
  assert.deepEqual(states, ['checking'])
})

test('address change clears the old generation and ignores its late response', async () => {
  const resolvers = []
  const states = []
  const controller = createSgtRequestController({
    check: () => new Promise((resolve) => resolvers.push(resolve)),
    timeoutMs: 1_000,
    onStateChange: (state) => states.push(state.status),
  })

  controller.start('wallet-one')
  controller.start('wallet-two')
  resolvers[0](detected)
  await settle()
  assert.deepEqual(states, ['checking', 'checking'])

  resolvers[1]({ ...detected, status: 'not_detected', sgtMintAddresses: [] })
  await settle()
  assert.deepEqual(states, ['checking', 'checking', 'not_detected'])
})

test('failure and timeout become unable, never not_detected', async () => {
  const states = []
  const controller = createSgtRequestController({
    check: async () => {
      throw new Error('backend unavailable')
    },
    timeoutMs: 100,
    onStateChange: (state) => states.push(state.status),
  })

  controller.start('wallet-one')
  await settle()
  assert.deepEqual(states, ['checking', 'unable'])
})

test('same-address start while active does not create a request storm', () => {
  let calls = 0
  const controller = createSgtRequestController({
    check: () => {
      calls += 1
      return new Promise(() => undefined)
    },
    timeoutMs: 1_000,
    onStateChange: () => undefined,
  })

  controller.start('wallet-one')
  controller.start('wallet-one')
  assert.equal(calls, 1)
  controller.cancel()
})

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
