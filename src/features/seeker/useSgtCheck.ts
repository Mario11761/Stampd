import { useEffect, useState } from 'react'
import { seekerConfig } from './config'
import { checkSgt } from './sgtApi'
import { createSgtRequestController, type SgtCheckState } from './sgtRequestController'

export function useSgtCheck(walletAddress: string | null): SgtCheckState {
  const [state, setState] = useState<SgtCheckState>(() =>
    walletAddress === null ? { status: 'idle' } : { status: 'checking', address: walletAddress },
  )

  useEffect(() => {
    const controller = createSgtRequestController({
      check: checkSgt,
      timeoutMs: seekerConfig.requestTimeoutMs,
      onStateChange: setState,
    })

    return controller.start(walletAddress)
  }, [walletAddress])

  return state
}
