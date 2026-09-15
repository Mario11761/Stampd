import type { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '@/src/theme/colors'
import { BottomNavigation, type MainTab } from './BottomNavigation'

type ProductShellProps = PropsWithChildren<{
  activeTab: MainTab
}>

export function ProductShell({ activeTab, children }: ProductShellProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.content}>{children}</View>
      <BottomNavigation active={activeTab} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  content: { flex: 1 },
  glow: {
    position: 'absolute',
    top: -190,
    right: -190,
    width: 390,
    height: 390,
    borderRadius: 195,
    backgroundColor: colors.glow,
    opacity: 0.08,
  },
})
