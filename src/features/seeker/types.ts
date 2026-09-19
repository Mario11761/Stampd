import { PublicKey } from '@solana/web3.js'

export type DetectedSgtResult = Readonly<{
  schemaVersion: 1
  status: 'detected'
  network: 'solana:mainnet'
  sgtMintAddresses: string[]
  observedSlot: number
  checkedAt: string
}>

export type NotDetectedSgtResult = Readonly<{
  schemaVersion: 1
  status: 'not_detected'
  network: 'solana:mainnet'
  sgtMintAddresses: []
  observedSlot: number
  checkedAt: string
}>

export type UnableSgtResult = Readonly<{
  schemaVersion: 1
  status: 'unable'
  code: string
  retryable: boolean
  requestId: string
}>

export type SgtCheckResult = DetectedSgtResult | NotDetectedSgtResult | UnableSgtResult

export function parseSgtCheckResult(value: unknown): SgtCheckResult | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.status !== 'string') {
    return null
  }

  if (value.status === 'detected' || value.status === 'not_detected') {
    const expectedKeys = ['checkedAt', 'network', 'observedSlot', 'schemaVersion', 'sgtMintAddresses', 'status']
    if (!hasExactKeys(value, expectedKeys) || value.network !== 'solana:mainnet') {
      return null
    }
    if (
      !Number.isSafeInteger(value.observedSlot) ||
      Number(value.observedSlot) < 0 ||
      typeof value.checkedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.checkedAt)) ||
      !Array.isArray(value.sgtMintAddresses) ||
      value.sgtMintAddresses.length > 32
    ) {
      return null
    }

    const mintAddresses = value.sgtMintAddresses
    if (!mintAddresses.every(isCanonicalPublicKey) || new Set(mintAddresses).size !== mintAddresses.length) {
      return null
    }
    if (value.status === 'detected' && mintAddresses.length === 0) {
      return null
    }
    if (value.status === 'not_detected' && mintAddresses.length !== 0) {
      return null
    }

    return value as DetectedSgtResult | NotDetectedSgtResult
  }

  if (value.status === 'unable') {
    if (
      !hasExactKeys(value, ['code', 'requestId', 'retryable', 'schemaVersion', 'status']) ||
      typeof value.code !== 'string' ||
      !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.code) ||
      typeof value.retryable !== 'boolean' ||
      typeof value.requestId !== 'string' ||
      value.requestId.length === 0 ||
      value.requestId.length > 128
    ) {
      return null
    }
    return value as UnableSgtResult
  }

  return null
}

function isCanonicalPublicKey(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  try {
    return new PublicKey(value).toBase58() === value
  } catch {
    return false
  }
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
  const actualKeys = Object.keys(value).sort()
  return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
