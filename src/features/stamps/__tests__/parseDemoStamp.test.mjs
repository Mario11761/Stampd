import assert from 'node:assert/strict'
import test from 'node:test'
import { DEMO_STAMP_PAYLOAD, MAX_DEMO_STAMP_PAYLOAD_LENGTH, parseDemoStamp } from '../demoStamp.ts'

const validPayload = JSON.stringify(DEMO_STAMP_PAYLOAD)

test('accepts the exact demo stamp JSON', () => {
  assert.equal(parseDemoStamp(validPayload).accepted, true)
})

const rejectedCases = [
  ['malformed JSON', '{'],
  ['empty input', ''],
  ['whitespace-only input', '   '],
  ['array', '[]'],
  ['null', 'null'],
  ['wrong v', JSON.stringify({ ...DEMO_STAMP_PAYLOAD, v: 2 })],
  ['wrong type', JSON.stringify({ ...DEMO_STAMP_PAYLOAD, type: 'other' })],
  ['wrong merchantId', JSON.stringify({ ...DEMO_STAMP_PAYLOAD, merchantId: 'other' })],
  ['wrong stampId', JSON.stringify({ ...DEMO_STAMP_PAYLOAD, stampId: 'other' })],
  ['extra property', JSON.stringify({ ...DEMO_STAMP_PAYLOAD, extra: true })],
  ['ordinary URL', 'https://example.com'],
  ['oversized payload', 'x'.repeat(MAX_DEMO_STAMP_PAYLOAD_LENGTH + 1)],
]

for (const [name, value] of rejectedCases) {
  test(`rejects ${name}`, () => {
    assert.equal(parseDemoStamp(value).accepted, false)
  })
}
