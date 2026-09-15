export const DEMO_STAMP_STORAGE_KEY = 'stampd:demo:seeker-coffee:stamp-5'
export const DEMO_STAMP_STORAGE_VALUE = 'collected'
export const MAX_DEMO_STAMP_PAYLOAD_LENGTH = 512

export const DEMO_STAMP_PAYLOAD = {
  v: 1,
  type: 'stampd_demo_stamp',
  merchantId: 'seeker-coffee',
  stampId: 'seeker-coffee-demo-5',
} as const

export type DemoStampPayload = typeof DEMO_STAMP_PAYLOAD

export type DemoStampParseResult = { accepted: true; payload: DemoStampPayload } | { accepted: false }

const REQUIRED_KEYS = ['v', 'type', 'merchantId', 'stampId'] as const

export function parseDemoStamp(rawValue: unknown): DemoStampParseResult {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return { accepted: false }
  }

  if (rawValue.length > MAX_DEMO_STAMP_PAYLOAD_LENGTH) {
    return { accepted: false }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(rawValue)
  } catch {
    return { accepted: false }
  }

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype
  ) {
    return { accepted: false }
  }

  const record = parsed as Record<string, unknown>
  const keys = Object.keys(record)

  if (
    keys.length !== REQUIRED_KEYS.length ||
    !REQUIRED_KEYS.every((key) => Object.prototype.hasOwnProperty.call(record, key))
  ) {
    return { accepted: false }
  }

  if (
    record.v !== DEMO_STAMP_PAYLOAD.v ||
    record.type !== DEMO_STAMP_PAYLOAD.type ||
    record.merchantId !== DEMO_STAMP_PAYLOAD.merchantId ||
    record.stampId !== DEMO_STAMP_PAYLOAD.stampId
  ) {
    return { accepted: false }
  }

  return { accepted: true, payload: DEMO_STAMP_PAYLOAD }
}
