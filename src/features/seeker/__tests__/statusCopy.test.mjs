import assert from 'node:assert/strict'
import test from 'node:test'
import { getSeekerStatusCopy } from '../statusCopy.ts'

test('uses the approved Stage 5A labels without Verified Seeker', () => {
  const copies = [
    getSeekerStatusCopy({ status: 'checking' }),
    getSeekerStatusCopy({ status: 'detected' }),
    getSeekerStatusCopy({ status: 'not_detected' }),
    getSeekerStatusCopy({ status: 'unable' }),
  ]

  assert.deepEqual(copies, [
    { headline: 'Checking...', detail: null },
    { headline: 'SGT Detected', detail: 'A Seeker Genesis Token was found for this wallet.' },
    { headline: 'No SGT Detected', detail: 'No Seeker Genesis Token was found for this wallet.' },
    { headline: 'Unable to Check', detail: 'Stampd could not verify SGT status right now.' },
  ])
  assert.equal(JSON.stringify(copies).includes('Verified Seeker'), false)
})
