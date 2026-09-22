import {
  base58FromUint8Array,
  base64FromUint8Array,
  base64ToUint8Array,
} from '@solana-mobile/mobile-wallet-adapter-protocol/encoding'
import { PublicKey } from '@solana/web3.js'
import type { SiwsDiagnosticBreadcrumb } from './siwsDiagnostics'

export const SIWS_EXPECTED = Object.freeze({
  domain: 'identity.stampdpass.com',
  uri: 'https://identity.stampdpass.com',
  statement: 'Sign in to Stampd to verify control of this wallet for Seeker status.',
  version: '1',
  chainId: 'solana:mainnet',
  ttlMs: 300_000,
})

export type SiwsChallenge = Readonly<{
  domain: typeof SIWS_EXPECTED.domain
  address: string
  statement: typeof SIWS_EXPECTED.statement
  uri: typeof SIWS_EXPECTED.uri
  version: typeof SIWS_EXPECTED.version
  chainId: typeof SIWS_EXPECTED.chainId
  nonce: string
  issuedAt: string
  expirationTime: string
  requestId: string
}>

export type ValidatedSignInResult = Readonly<{
  address: string
  signedMessage: string
  signature: string
  signatureType: 'ed25519'
}>

export type WalletControlProof = Readonly<{
  address: string
  verifiedAt: string
  proofExpiresAt: string
}>

export function createChallengeRequestBody(capturedAddress: string) {
  return { walletAddress: capturedAddress } as const
}

export function createVerifyRequestBody(
  capturedAddress: string,
  challenge: SiwsChallenge,
  signInResult: ValidatedSignInResult,
) {
  return {
    requestId: challenge.requestId,
    address: capturedAddress,
    signedMessage: signInResult.signedMessage,
    signature: signInResult.signature,
    signatureType: 'ed25519' as const,
  }
}

const CHALLENGE_KEYS = [
  'address',
  'chainId',
  'domain',
  'expirationTime',
  'issuedAt',
  'nonce',
  'requestId',
  'statement',
  'uri',
  'version',
]

export function parseChallengeResponse(value: unknown, capturedAddress: string, nowMs: number): SiwsChallenge | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['challenge', 'schemaVersion', 'status']) ||
    value.schemaVersion !== 1 ||
    value.status !== 'issued' ||
    !isRecord(value.challenge) ||
    !hasExactKeys(value.challenge, CHALLENGE_KEYS)
  ) {
    return null
  }

  const challenge = value.challenge
  if (
    challenge.domain !== SIWS_EXPECTED.domain ||
    challenge.address !== capturedAddress ||
    challenge.statement !== SIWS_EXPECTED.statement ||
    challenge.uri !== SIWS_EXPECTED.uri ||
    challenge.version !== SIWS_EXPECTED.version ||
    challenge.chainId !== SIWS_EXPECTED.chainId ||
    typeof challenge.nonce !== 'string' ||
    !/^[0-9a-f]{32}$/.test(challenge.nonce) ||
    typeof challenge.requestId !== 'string' ||
    !/^[0-9a-f]{32}$/.test(challenge.requestId) ||
    typeof challenge.issuedAt !== 'string' ||
    typeof challenge.expirationTime !== 'string' ||
    !isCanonicalIsoUtc(challenge.issuedAt) ||
    !isCanonicalIsoUtc(challenge.expirationTime)
  ) {
    return null
  }

  const issuedAtMs = Date.parse(challenge.issuedAt)
  const expirationTimeMs = Date.parse(challenge.expirationTime)
  if (expirationTimeMs - issuedAtMs !== SIWS_EXPECTED.ttlMs || expirationTimeMs <= nowMs) {
    return null
  }

  return challenge as SiwsChallenge
}

export function parseSignInResult(
  value: unknown,
  accounts: readonly { address: string }[],
  capturedAddress: string,
  onDiagnostic?: (breadcrumb: SiwsDiagnosticBreadcrumb) => void,
): ValidatedSignInResult | null {
  if (!isRecord(value)) {
    onDiagnostic?.(value === undefined || value === null ? 'SIGN_IN_RESULT_MISSING' : 'SIGN_IN_RESULT_INVALID_SHAPE')
    return null
  }

  const keys = Object.keys(value).sort()
  const requiredKeys = ['address', 'signature', 'signed_message']
  const allowedWithType = [...requiredKeys, 'signature_type'].sort()
  if (!hasExactKeyList(keys, requiredKeys.sort()) && !hasExactKeyList(keys, allowedWithType)) {
    onDiagnostic?.('SIGN_IN_RESULT_INVALID_SHAPE')
    return null
  }
  if (
    typeof value.address !== 'string' ||
    typeof value.signed_message !== 'string' ||
    typeof value.signature !== 'string'
  ) {
    onDiagnostic?.('SIGN_IN_RESULT_INVALID_SHAPE')
    return null
  }
  if (value.signature_type !== undefined && value.signature_type !== 'ed25519') {
    onDiagnostic?.('SIGN_IN_RESULT_INVALID_SIGNATURE_TYPE')
    return null
  }

  const addressBytes = decodeCanonicalBase64(value.address)
  if (addressBytes === null || addressBytes.byteLength !== 32) {
    onDiagnostic?.('SIGN_IN_RESULT_INVALID_ADDRESS_ENCODING')
    return null
  }
  const signedMessageBytes = decodeCanonicalBase64(value.signed_message)
  if (signedMessageBytes === null || signedMessageBytes.byteLength === 0 || signedMessageBytes.byteLength > 1_024) {
    onDiagnostic?.('SIGN_IN_RESULT_INVALID_MESSAGE_ENCODING')
    return null
  }
  const signatureBytes = decodeCanonicalBase64(value.signature)
  if (signatureBytes === null) {
    onDiagnostic?.('SIGN_IN_RESULT_INVALID_SIGNATURE_ENCODING')
    return null
  }
  if (signatureBytes.byteLength !== 64) {
    onDiagnostic?.('SIGN_IN_RESULT_INVALID_SIGNATURE_LENGTH')
    return null
  }

  const signedAddress = base58FromUint8Array(addressBytes)
  if (signedAddress !== capturedAddress || !isCanonicalPublicKey(capturedAddress)) {
    onDiagnostic?.('ADDRESS_MISMATCH')
    return null
  }
  onDiagnostic?.('ADDRESS_MATCH')

  const authorizedAddresses = accounts
    .map((account) => decodeCanonicalBase64(account.address))
    .filter((bytes): bytes is Uint8Array => bytes !== null && bytes.byteLength === 32)
    .map(base58FromUint8Array)
  if (!authorizedAddresses.includes(capturedAddress)) {
    onDiagnostic?.('ACCOUNT_MISMATCH')
    return null
  }
  onDiagnostic?.('ACCOUNT_MATCH')

  return {
    address: signedAddress,
    signedMessage: value.signed_message,
    signature: value.signature,
    signatureType: 'ed25519',
  }
}

export function parseVerifyResponse(value: unknown, capturedAddress: string, nowMs: number): WalletControlProof | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['address', 'proofExpiresAt', 'schemaVersion', 'status', 'verifiedAt']) ||
    value.schemaVersion !== 1 ||
    value.status !== 'wallet_control_verified' ||
    value.address !== capturedAddress ||
    typeof value.verifiedAt !== 'string' ||
    typeof value.proofExpiresAt !== 'string' ||
    !isCanonicalIsoUtc(value.verifiedAt) ||
    !isCanonicalIsoUtc(value.proofExpiresAt)
  ) {
    return null
  }

  const verifiedAtMs = Date.parse(value.verifiedAt)
  const proofExpiresAtMs = Date.parse(value.proofExpiresAt)
  if (proofExpiresAtMs - verifiedAtMs !== SIWS_EXPECTED.ttlMs || proofExpiresAtMs <= nowMs) {
    return null
  }

  return {
    address: capturedAddress,
    verifiedAt: value.verifiedAt,
    proofExpiresAt: value.proofExpiresAt,
  }
}

function decodeCanonicalBase64(value: string): Uint8Array | null {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return null
  }
  try {
    const bytes = base64ToUint8Array(value)
    return base64FromUint8Array(bytes) === value ? bytes : null
  } catch {
    return null
  }
}

function isCanonicalPublicKey(value: string): boolean {
  try {
    return new PublicKey(value).toBase58() === value
  } catch {
    return false
  }
}

function isCanonicalIsoUtc(value: string): boolean {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
  return hasExactKeyList(Object.keys(value).sort(), [...expectedKeys].sort())
}

function hasExactKeyList(actualKeys: string[], expectedKeys: string[]): boolean {
  return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
