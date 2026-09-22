import {
  createChallengeRequestBody,
  createVerifyRequestBody,
  parseChallengeResponse,
  parseVerifyResponse,
  type SiwsChallenge,
  type ValidatedSignInResult,
  type WalletControlProof,
} from './siwsTypes'
import type { SiwsDiagnosticBreadcrumb } from './siwsDiagnostics'

const AUTH_ORIGIN = 'https://auth.stampdpass.com'
export const SIWS_NETWORK_TIMEOUT_MS = 30_000

type SiwsApiOptions = Readonly<{
  nowMs?: number
  timeoutMs?: number
  onDiagnostic?: (breadcrumb: SiwsDiagnosticBreadcrumb) => void
}>

export class SiwsApiError extends Error {
  readonly code: string
  readonly httpStatus?: number

  constructor(code: string, httpStatus?: number) {
    super(code)
    this.name = 'SiwsApiError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

export async function requestSiwsChallenge(
  capturedAddress: string,
  signal: AbortSignal,
  options: SiwsApiOptions = {},
): Promise<SiwsChallenge> {
  const diagnose = options.onDiagnostic
  let response: Response
  try {
    response = await fetchWithTimeout(
      `${AUTH_ORIGIN}/v1/siws/challenge`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createChallengeRequestBody(capturedAddress)),
      },
      signal,
      options.timeoutMs ?? SIWS_NETWORK_TIMEOUT_MS,
      'CHALLENGE_TIMEOUT',
    )
  } catch (error: unknown) {
    if (error instanceof SiwsApiError && error.code === 'CHALLENGE_TIMEOUT') {
      diagnose?.('CHALLENGE_TIMEOUT')
      throw error
    }
    if (signal.aborted || isAbortError(error)) {
      diagnose?.('CHALLENGE_ABORTED')
      throw new SiwsApiError('CHALLENGE_ABORTED')
    }
    diagnose?.('CHALLENGE_FETCH_FAILED')
    throw new SiwsApiError('CHALLENGE_FETCH_FAILED')
  }

  diagnoseHttpStatus('challenge', response.status, diagnose)
  const value: unknown = await readJson(response, () => diagnose?.('CHALLENGE_RESPONSE_INVALID'))
  if (response.status !== 201) {
    throw new SiwsApiError(readSafeCode(value, 'CHALLENGE_REQUEST_FAILED'), response.status)
  }
  const challenge = parseChallengeResponse(value, capturedAddress, options.nowMs ?? Date.now())
  if (challenge === null) {
    diagnose?.('CHALLENGE_RESPONSE_INVALID')
    throw new SiwsApiError('INVALID_CHALLENGE_RESPONSE', response.status)
  }
  return challenge
}

export async function verifySiwsResult(
  capturedAddress: string,
  challenge: SiwsChallenge,
  signInResult: ValidatedSignInResult,
  signal: AbortSignal,
  options: SiwsApiOptions = {},
): Promise<WalletControlProof> {
  const diagnose = options.onDiagnostic
  diagnose?.('VERIFY_REQUEST_SENT')
  let response: Response
  try {
    response = await fetchWithTimeout(
      `${AUTH_ORIGIN}/v1/siws/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createVerifyRequestBody(capturedAddress, challenge, signInResult)),
      },
      signal,
      options.timeoutMs ?? SIWS_NETWORK_TIMEOUT_MS,
      'VERIFY_TIMEOUT',
    )
  } catch (error: unknown) {
    if (error instanceof SiwsApiError && error.code === 'VERIFY_TIMEOUT') {
      diagnose?.('VERIFY_TIMEOUT')
      throw error
    }
    if (signal.aborted || isAbortError(error)) {
      diagnose?.('VERIFY_ABORTED')
      throw new SiwsApiError('VERIFY_ABORTED')
    }
    diagnose?.('VERIFY_FETCH_FAILED')
    throw new SiwsApiError('VERIFY_FETCH_FAILED')
  }

  diagnoseHttpStatus('verify', response.status, diagnose)
  const value: unknown = await readJson(response, () => diagnose?.('VERIFY_RESPONSE_INVALID'))
  if (response.status !== 200) {
    throw new SiwsApiError(readSafeCode(value, 'VERIFICATION_FAILED'), response.status)
  }
  const proof = parseVerifyResponse(value, capturedAddress, options.nowMs ?? Date.now())
  if (proof === null) {
    diagnose?.('VERIFY_RESPONSE_INVALID')
    throw new SiwsApiError('INVALID_VERIFY_RESPONSE', response.status)
  }
  return proof
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  externalSignal: AbortSignal,
  timeoutMs: number,
  timeoutCode: 'CHALLENGE_TIMEOUT' | 'VERIFY_TIMEOUT',
): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort()

  if (externalSignal.aborted) {
    controller.abort()
  } else {
    externalSignal.addEventListener('abort', abortFromCaller, { once: true })
  }

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  unrefTimer(timer)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (timedOut) {
      throw new SiwsApiError(timeoutCode)
    }
    return response
  } catch (error: unknown) {
    if (timedOut) {
      throw new SiwsApiError(timeoutCode)
    }
    throw error
  } finally {
    clearTimeout(timer)
    externalSignal.removeEventListener('abort', abortFromCaller)
  }
}

async function readJson(response: Response, onInvalid: () => void): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    onInvalid()
    throw new SiwsApiError('INVALID_JSON_RESPONSE', response.status)
  }
}

function diagnoseHttpStatus(
  request: 'challenge' | 'verify',
  status: number,
  diagnose?: (breadcrumb: SiwsDiagnosticBreadcrumb) => void,
): void {
  if (request === 'challenge') {
    if (status === 201) diagnose?.('CHALLENGE_HTTP_201')
    else if (status === 429) diagnose?.('CHALLENGE_HTTP_429')
    else if (status >= 400 && status < 500) diagnose?.('CHALLENGE_HTTP_4XX')
    else if (status >= 500) diagnose?.('CHALLENGE_HTTP_5XX')
    else diagnose?.('CHALLENGE_RESPONSE_INVALID')
    return
  }

  if (status === 200) diagnose?.('VERIFY_HTTP_200')
  else if (status === 400) diagnose?.('VERIFY_HTTP_400')
  else if (status === 409) diagnose?.('VERIFY_HTTP_409')
  else if (status === 410) diagnose?.('VERIFY_HTTP_410')
  else if (status === 429) diagnose?.('VERIFY_HTTP_429')
  else if (status >= 500) diagnose?.('VERIFY_HTTP_5XX')
  else diagnose?.('VERIFY_RESPONSE_INVALID')
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  const nodeTimer = timer as unknown as { unref?: () => void }
  nodeTimer.unref?.()
}

function readSafeCode(value: unknown, fallback: string): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    /^[A-Z][A-Z0-9_]{0,63}$/.test(value.code)
  ) {
    return value.code
  }
  return fallback
}
