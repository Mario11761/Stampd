import type { SiwsChallenge, ValidatedSignInResult, WalletControlProof } from './siwsTypes'
import type { SiwsDiagnosticBreadcrumb } from './siwsDiagnostics'

export type SiwsFlowState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'safety' }>
  | Readonly<{ status: 'requesting_challenge' }>
  | Readonly<{ status: 'opening_wallet' }>
  | Readonly<{ status: 'verifying' }>
  | Readonly<{ status: 'verified' }>
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{ status: 'unable'; code: string }>

type Attempt = Readonly<{
  generation: number
  attemptId: string
  capturedAddress: string
  challengeRequestId?: string
  expirationTime?: string
}>

type ErrorKind = 'cancelled' | 'unable'
type TimerHandle = ReturnType<typeof setTimeout>

export function createSiwsAttemptController(options: {
  getCurrentAddress: () => string | null
  requestChallenge: (
    address: string,
    signal: AbortSignal,
    onDiagnostic?: (breadcrumb: SiwsDiagnosticBreadcrumb) => void,
  ) => Promise<SiwsChallenge>
  authorize: (
    challenge: SiwsChallenge,
    capturedAddress: string,
    onDiagnostic?: (breadcrumb: SiwsDiagnosticBreadcrumb) => void,
  ) => Promise<ValidatedSignInResult>
  verify: (
    capturedAddress: string,
    challenge: SiwsChallenge,
    result: ValidatedSignInResult,
    signal: AbortSignal,
    onDiagnostic?: (breadcrumb: SiwsDiagnosticBreadcrumb) => void,
  ) => Promise<WalletControlProof>
  classifyError: (error: unknown) => ErrorKind
  getSafeErrorCode: (error: unknown) => string
  onStateChange: (state: SiwsFlowState) => void
  onProofChange: (proof: WalletControlProof | null) => void
  onDiagnostic?: (breadcrumb: SiwsDiagnosticBreadcrumb) => void
  onDiagnosticsReset?: () => void
  now?: () => number
  scheduleTimer?: (callback: () => void, delayMs: number) => TimerHandle
  cancelTimer?: (timer: TimerHandle) => void
}) {
  let generation = 0
  let activeAttempt: Attempt | null = null
  let requestController: AbortController | null = null
  let challengeExpiryTimer: ReturnType<typeof setTimeout> | null = null
  let proofExpiryTimer: ReturnType<typeof setTimeout> | null = null
  let currentState: SiwsFlowState = { status: 'idle' }
  const now = options.now ?? Date.now
  const scheduleTimer = options.scheduleTimer ?? setTimeout
  const cancelTimer = options.cancelTimer ?? clearTimeout
  const diagnose = (breadcrumb: SiwsDiagnosticBreadcrumb) => options.onDiagnostic?.(breadcrumb)

  const emit = (state: SiwsFlowState) => {
    currentState = state
    options.onStateChange(state)
  }

  const clearChallengeTimer = () => {
    if (challengeExpiryTimer !== null) {
      cancelTimer(challengeExpiryTimer)
      challengeExpiryTimer = null
    }
  }

  const clearProofTimer = () => {
    if (proofExpiryTimer !== null) {
      cancelTimer(proofExpiryTimer)
      proofExpiryTimer = null
    }
  }

  const invalidate = (clearProof = true, clearDiagnostics = true) => {
    generation += 1
    activeAttempt = null
    requestController?.abort()
    requestController = null
    clearChallengeTimer()
    clearProofTimer()
    if (clearProof) {
      options.onProofChange(null)
    }
    if (clearDiagnostics) {
      options.onDiagnosticsReset?.()
    }
  }

  const isSameActiveAttempt = (attempt: Attempt): boolean => {
    return (
      activeAttempt !== null &&
      generation === attempt.generation &&
      activeAttempt.attemptId === attempt.attemptId &&
      activeAttempt.capturedAddress === attempt.capturedAddress
    )
  }

  const isChallengeUnexpired = (attempt: Attempt): boolean => {
    return attempt.expirationTime === undefined || Date.parse(attempt.expirationTime) > now()
  }

  const expireAttempt = (attempt: Attempt): boolean => {
    if (!isSameActiveAttempt(attempt)) {
      return false
    }
    invalidate(false, false)
    diagnose('CHALLENGE_EXPIRED')
    emit({ status: 'unable', code: 'CHALLENGE_EXPIRED' })
    return true
  }

  const canContinue = (attempt: Attempt): boolean => {
    if (!isSameActiveAttempt(attempt)) {
      return false
    }
    if (options.getCurrentAddress() !== attempt.capturedAddress) {
      invalidate(false)
      return false
    }
    if (!isChallengeUnexpired(attempt)) {
      expireAttempt(attempt)
      return false
    }
    return true
  }

  const requestVerification = (): boolean => {
    if (activeAttempt !== null || options.getCurrentAddress() === null) {
      return false
    }
    options.onDiagnosticsReset?.()
    emit({ status: 'safety' })
    return true
  }

  const cancelSafety = () => {
    if (activeAttempt === null && currentState.status === 'safety') {
      emit({ status: 'cancelled' })
    }
  }

  const continueVerification = async (): Promise<void> => {
    if (activeAttempt !== null || currentState.status !== 'safety') {
      return
    }
    const capturedAddress = options.getCurrentAddress()
    if (capturedAddress === null) {
      emit({ status: 'idle' })
      return
    }

    generation += 1
    const requestGeneration = generation
    let attempt: Attempt = {
      generation: requestGeneration,
      attemptId: `${now().toString(36)}-${requestGeneration.toString(36)}`,
      capturedAddress,
    }
    activeAttempt = attempt
    requestController = new AbortController()
    clearProofTimer()
    options.onProofChange(null)
    let stage: 'challenge' | 'authorize' | 'verify' = 'challenge'
    const diagnoseAttempt = (breadcrumb: SiwsDiagnosticBreadcrumb) => {
      if (isSameActiveAttempt(attempt)) {
        diagnose(breadcrumb)
      }
    }

    try {
      emit({ status: 'requesting_challenge' })
      diagnoseAttempt('CHALLENGE_REQUEST_SENT')
      const challenge = await options.requestChallenge(capturedAddress, requestController.signal, diagnoseAttempt)
      if (!canContinue(attempt)) return

      attempt = {
        ...attempt,
        challengeRequestId: challenge.requestId,
        expirationTime: challenge.expirationTime,
      }
      activeAttempt = attempt
      const remainingMs = Date.parse(challenge.expirationTime) - now()
      if (remainingMs <= 0) {
        expireAttempt(attempt)
        return
      }
      diagnoseAttempt('CHALLENGE_VALID')
      challengeExpiryTimer = scheduleTimer(() => {
        if (!isSameActiveAttempt(attempt)) {
          return
        }
        if (options.getCurrentAddress() !== attempt.capturedAddress) {
          invalidate(false)
          return
        }
        expireAttempt(attempt)
      }, remainingMs)
      unrefTimer(challengeExpiryTimer)

      stage = 'authorize'
      emit({ status: 'opening_wallet' })
      const signInResult = await options.authorize(challenge, capturedAddress, diagnoseAttempt)
      if (!canContinue(attempt)) return

      stage = 'verify'
      emit({ status: 'verifying' })
      const proof = await options.verify(
        capturedAddress,
        challenge,
        signInResult,
        requestController.signal,
        diagnoseAttempt,
      )
      if (!canContinue(attempt) || proof.address !== capturedAddress || Date.parse(proof.proofExpiresAt) <= now())
        return

      activeAttempt = null
      requestController = null
      clearChallengeTimer()
      options.onProofChange(proof)
      diagnose('VERIFY_SUCCESS')
      emit({ status: 'verified' })
      proofExpiryTimer = scheduleTimer(
        () => {
          proofExpiryTimer = null
          if (generation === requestGeneration) {
            options.onProofChange(null)
            emit({ status: 'idle' })
          }
        },
        Date.parse(proof.proofExpiresAt) - now(),
      )
      unrefTimer(proofExpiryTimer)
    } catch (error: unknown) {
      if (!isSameActiveAttempt(attempt)) return
      if (options.getCurrentAddress() !== attempt.capturedAddress) {
        invalidate(false)
        return
      }
      if (!isChallengeUnexpired(attempt)) {
        expireAttempt(attempt)
        return
      }
      const kind = options.classifyError(error)
      if (stage === 'authorize') {
        diagnoseAttempt(kind === 'cancelled' ? 'MWA_AUTHORIZE_CANCELLED' : 'MWA_AUTHORIZE_FAILED_SAFE')
      }
      activeAttempt = null
      requestController = null
      clearChallengeTimer()
      emit(kind === 'cancelled' ? { status: 'cancelled' } : { status: 'unable', code: options.getSafeErrorCode(error) })
    }
  }

  return {
    cancelSafety,
    continueVerification,
    hasActiveAttempt: () => activeAttempt !== null,
    invalidate,
    requestVerification,
  }
}

function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  const nodeTimer = timer as unknown as { unref?: () => void }
  nodeTimer.unref?.()
}
