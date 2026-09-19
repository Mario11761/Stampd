import type { SgtCheckState } from './sgtRequestController'

export type SeekerStatusCopy = Readonly<{
  headline: string
  detail: string | null
}>

export function getSeekerStatusCopy(state: SgtCheckState): SeekerStatusCopy | null {
  switch (state.status) {
    case 'idle':
      return null
    case 'checking':
      return { headline: 'Checking...', detail: null }
    case 'detected':
      return {
        headline: 'SGT Detected',
        detail: 'A Seeker Genesis Token was found for this wallet.',
      }
    case 'not_detected':
      return {
        headline: 'No SGT Detected',
        detail: 'No Seeker Genesis Token was found for this wallet.',
      }
    case 'unable':
      return {
        headline: 'Unable to Check',
        detail: 'Stampd could not verify SGT status right now.',
      }
  }
}
