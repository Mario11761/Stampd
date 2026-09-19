import type { SgtCheckResult } from './types'

export type SgtCheckState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'checking' }>
  | Readonly<{ status: 'detected' }>
  | Readonly<{ status: 'not_detected' }>
  | Readonly<{ status: 'unable' }>

type CheckSgt = (walletAddress: string, signal: AbortSignal) => Promise<SgtCheckResult>

export function createSgtRequestController(options: {
  check: CheckSgt
  timeoutMs: number
  onStateChange: (state: SgtCheckState) => void
}) {
  let generation = 0
  let activeController: AbortController | null = null
  let activeAddress: string | null = null

  const cancel = () => {
    generation += 1
    activeAddress = null
    activeController?.abort()
    activeController = null
  }

  const start = (walletAddress: string | null): (() => void) => {
    if (walletAddress === null) {
      cancel()
      options.onStateChange({ status: 'idle' })
      return () => undefined
    }

    if (activeAddress === walletAddress && activeController !== null) {
      return () => undefined
    }

    cancel()
    activeAddress = walletAddress
    const requestGeneration = generation
    const controller = new AbortController()
    activeController = controller
    options.onStateChange({ status: 'checking' })

    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
    void options
      .check(walletAddress, controller.signal)
      .then((result) => {
        if (generation !== requestGeneration || controller.signal.aborted) {
          return
        }
        options.onStateChange({ status: result.status })
      })
      .catch(() => {
        if (generation === requestGeneration) {
          options.onStateChange({ status: 'unable' })
        }
      })
      .finally(() => {
        clearTimeout(timeout)
        if (generation === requestGeneration) {
          activeController = null
        }
      })

    return () => {
      if (generation === requestGeneration) {
        cancel()
      }
    }
  }

  return { cancel, start }
}
