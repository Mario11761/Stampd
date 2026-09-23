import type { SiwsFlowState } from '@/src/features/wallet/siwsAttemptController'
import type { WalletControlProof } from '@/src/features/wallet/siwsTypes'
import type { SgtCheckState } from './sgtRequestController'

export type VerifiedSeekerInputs = Readonly<{
  connectedAddress: string | null
  sessionAddress: string | null
  sessionEpoch: number
  sgtState: SgtCheckState
  siwsState: SiwsFlowState
  siwsProof: WalletControlProof | null
  proofSessionEpoch: number | null
  nowMs: number
}>

export function isVerifiedSeeker(input: VerifiedSeekerInputs): boolean {
  const { connectedAddress, sessionAddress, sessionEpoch, sgtState, siwsState, siwsProof, proofSessionEpoch, nowMs } =
    input

  if (
    connectedAddress === null ||
    connectedAddress.length === 0 ||
    sessionAddress !== connectedAddress ||
    !Number.isSafeInteger(sessionEpoch) ||
    sessionEpoch < 1 ||
    proofSessionEpoch !== sessionEpoch ||
    sgtState.status !== 'detected' ||
    sgtState.address !== connectedAddress ||
    siwsState.status !== 'verified' ||
    siwsProof === null ||
    siwsProof.address !== connectedAddress ||
    !Number.isFinite(nowMs) ||
    typeof siwsProof.proofExpiresAt !== 'string'
  ) {
    return false
  }

  const expiresAtMs = Date.parse(siwsProof.proofExpiresAt)
  return (
    Number.isFinite(expiresAtMs) &&
    new Date(expiresAtMs).toISOString() === siwsProof.proofExpiresAt &&
    expiresAtMs > nowMs
  )
}
