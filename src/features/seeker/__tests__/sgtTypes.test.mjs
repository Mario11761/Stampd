import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSgtCheckResult } from '../types.ts'

const base = {
  schemaVersion: 1,
  network: 'solana:mainnet',
  observedSlot: 123,
  checkedAt: '2026-09-17T04:00:00.000Z',
}

test('parses detected, not_detected, and unable contracts', () => {
  assert.equal(
    parseSgtCheckResult({ ...base, status: 'detected', sgtMintAddresses: ['11111111111111111111111111111111'] })
      ?.status,
    'detected',
  )
  assert.equal(parseSgtCheckResult({ ...base, status: 'not_detected', sgtMintAddresses: [] })?.status, 'not_detected')
  assert.equal(
    parseSgtCheckResult({
      schemaVersion: 1,
      status: 'unable',
      code: 'UPSTREAM_TIMEOUT',
      retryable: true,
      requestId: 'id',
    })?.status,
    'unable',
  )
})

test('rejects malformed, ambiguous, and extra-field responses', () => {
  const invalid = [
    null,
    { ...base, status: 'detected', sgtMintAddresses: [] },
    { ...base, status: 'not_detected', sgtMintAddresses: ['11111111111111111111111111111111'] },
    { ...base, status: 'detected', sgtMintAddresses: ['not-a-mint'] },
    { ...base, status: 'detected', sgtMintAddresses: ['11111111111111111111111111111111'], extra: true },
    { schemaVersion: 1, status: 'unable', code: 'bad code', retryable: true, requestId: 'id' },
  ]

  for (const value of invalid) {
    assert.equal(parseSgtCheckResult(value), null)
  }
})
