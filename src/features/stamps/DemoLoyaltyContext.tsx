import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { DEMO_STAMP_STORAGE_KEY, DEMO_STAMP_STORAGE_VALUE } from './demoStamp'

export type CollectDemoStampResult = 'COLLECTED' | 'DUPLICATE' | 'NOT_READY' | 'STORAGE_ERROR'
export type ResetDemoStampResult = 'RESET' | 'STORAGE_ERROR'

type DemoLoyaltyContextValue = {
  isReady: boolean
  isDemoStampCollected: boolean
  collectDemoStamp: () => Promise<CollectDemoStampResult>
  resetDemoStamp: () => Promise<ResetDemoStampResult>
}

const DemoLoyaltyContext = createContext<DemoLoyaltyContextValue | null>(null)

export function DemoLoyaltyProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false)
  const [isDemoStampCollected, setIsDemoStampCollected] = useState(false)
  const collectedRef = useRef(false)
  const writeInProgressRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const hydrate = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(DEMO_STAMP_STORAGE_KEY)
        const collected = storedValue === DEMO_STAMP_STORAGE_VALUE

        if (isMounted) {
          collectedRef.current = collected
          setIsDemoStampCollected(collected)
        }
      } catch {
        if (isMounted) {
          collectedRef.current = false
          setIsDemoStampCollected(false)
        }
      } finally {
        if (isMounted) {
          setIsReady(true)
        }
      }
    }

    void hydrate()

    return () => {
      isMounted = false
    }
  }, [])

  const collectDemoStamp = useCallback(async (): Promise<CollectDemoStampResult> => {
    if (!isReady) {
      return 'NOT_READY'
    }

    if (collectedRef.current || writeInProgressRef.current) {
      return 'DUPLICATE'
    }

    writeInProgressRef.current = true

    try {
      const storedValue = await AsyncStorage.getItem(DEMO_STAMP_STORAGE_KEY)

      if (storedValue === DEMO_STAMP_STORAGE_VALUE) {
        collectedRef.current = true
        setIsDemoStampCollected(true)
        return 'DUPLICATE'
      }

      await AsyncStorage.setItem(DEMO_STAMP_STORAGE_KEY, DEMO_STAMP_STORAGE_VALUE)
      collectedRef.current = true
      setIsDemoStampCollected(true)
      return 'COLLECTED'
    } catch {
      return 'STORAGE_ERROR'
    } finally {
      writeInProgressRef.current = false
    }
  }, [isReady])

  const resetDemoStamp = useCallback(async (): Promise<ResetDemoStampResult> => {
    try {
      await AsyncStorage.removeItem(DEMO_STAMP_STORAGE_KEY)
      collectedRef.current = false
      setIsDemoStampCollected(false)
      return 'RESET'
    } catch {
      return 'STORAGE_ERROR'
    }
  }, [])

  const value = useMemo(
    () => ({ isReady, isDemoStampCollected, collectDemoStamp, resetDemoStamp }),
    [collectDemoStamp, isDemoStampCollected, isReady, resetDemoStamp],
  )

  return <DemoLoyaltyContext.Provider value={value}>{children}</DemoLoyaltyContext.Provider>
}

export function useDemoLoyalty() {
  const context = useContext(DemoLoyaltyContext)

  if (!context) {
    throw new Error('useDemoLoyalty must be used within DemoLoyaltyProvider')
  }

  return context
}
