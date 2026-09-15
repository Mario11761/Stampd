import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/src/theme/colors'

export type MainTab = 'passport' | 'scan' | 'rewards'

type BottomNavigationProps = {
  active: MainTab
}

const destinations = {
  passport: '/passport',
  scan: '/scan',
  rewards: '/rewards',
} as const

export function BottomNavigation({ active }: BottomNavigationProps) {
  const goTo = (tab: MainTab) => {
    if (tab !== active) {
      router.replace(destinations[tab])
    }
  }

  return (
    <View accessibilityRole="tablist" style={styles.navigation}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'passport' }}
        onPress={() => goTo('passport')}
        style={styles.sideTab}
      >
        <View style={[styles.sideIcon, active === 'passport' && styles.sideIconActive]} />
        <Text style={[styles.label, active === 'passport' && styles.labelActive]}>Passport</Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Scan"
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'scan' }}
        onPress={() => goTo('scan')}
        style={styles.scanTab}
      >
        <View style={[styles.scanButton, active === 'scan' && styles.scanButtonActive]}>
          <View style={styles.scanCorners}>
            <View style={styles.scanLine} />
          </View>
          <Text style={styles.scanLabel}>SCAN</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'rewards' }}
        onPress={() => goTo('rewards')}
        style={styles.sideTab}
      >
        <Text style={[styles.rewardIcon, active === 'rewards' && styles.rewardIconActive]}>✦</Text>
        <Text style={[styles.label, active === 'rewards' && styles.labelActive]}>Rewards</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  navigation: {
    height: 82,
    paddingHorizontal: 20,
    paddingTop: 9,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundRaised,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  sideTab: { width: 78, height: 61, alignItems: 'center', justifyContent: 'center', gap: 7 },
  sideIcon: {
    width: 19,
    height: 23,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.muted,
    transform: [{ rotate: '-5deg' }],
  },
  sideIconActive: { borderColor: colors.accent, backgroundColor: colors.surfaceStrong },
  rewardIcon: { height: 23, color: colors.muted, fontSize: 23, lineHeight: 25 },
  rewardIconActive: { color: colors.accent },
  label: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  labelActive: { color: colors.accent },
  scanTab: { width: 98, height: 88, alignItems: 'center', justifyContent: 'flex-start' },
  scanButton: {
    width: 76,
    height: 76,
    marginTop: -24,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.accentStrong,
    borderWidth: 5,
    borderColor: colors.background,
    elevation: 8,
    shadowColor: colors.accentStrong,
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  scanButtonActive: { backgroundColor: colors.accent },
  scanCorners: {
    width: 25,
    height: 19,
    borderWidth: 2,
    borderRadius: 4,
    borderColor: colors.accentInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: { width: 17, height: 2, backgroundColor: colors.accentInk },
  scanLabel: { color: colors.accentInk, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
})
