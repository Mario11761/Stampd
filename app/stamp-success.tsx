import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandMark } from '@/src/components/BrandMark'
import { StampProgress } from '@/src/components/StampProgress'
import { useDemoLoyalty } from '@/src/features/stamps/DemoLoyaltyContext'
import { colors } from '@/src/theme/colors'

export default function StampSuccessScreen() {
  const { isDemoStampCollected, isReady } = useDemoLoyalty()

  if (!isReady || !isDemoStampCollected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.fallback}>
          <BrandMark compact />
          <Text style={styles.fallbackTitle}>No stamp collected</Text>
          <Text style={styles.fallbackCopy}>A successful local save is required before this screen can be shown.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/passport')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Back to Passport</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.content}>
        <BrandMark compact />

        <View style={styles.successCard}>
          <View style={styles.checkCircle}>
            <Text style={styles.check}>✓</Text>
          </View>
          <Text style={styles.eyebrow}>STAMP COLLECTED</Text>
          <Text style={styles.title}>Seeker Coffee</Text>
          <Text style={styles.progressText}>5 / 5 stamps</Text>

          <View style={styles.stamps}>
            <StampProgress current={5} total={5} />
          </View>

          <View style={styles.rewardBlock}>
            <Text style={styles.rewardLabel}>DEMO ELIGIBILITY UNLOCKED</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardAmount}>20</Text>
              <Text style={styles.rewardCurrency}>SKR</Text>
            </View>
            <Text style={styles.rewardQualifier}>DEMO REWARD TARGET</Text>
            <View style={styles.readyBadge}>
              <Text style={styles.readyText}>Eligibility Ready · Demo</Text>
            </View>
            <Text style={styles.rewardDisclaimer}>
              Demo reward eligibility only. No SKR has been transferred or claimed.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: '/reward/[id]',
                params: { id: 'seeker-coffee' },
              })
            }
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>View Eligibility</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/passport')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Back to Passport</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  glow: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: colors.glow,
    opacity: 0.12,
  },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 },
  successCard: {
    flex: 1,
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  check: { color: colors.accentInk, fontSize: 31, lineHeight: 36, fontWeight: '900' },
  eyebrow: { marginTop: 19, color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: {
    marginTop: 7,
    color: colors.text,
    fontSize: 35,
    lineHeight: 41,
    fontWeight: '900',
    letterSpacing: -1.4,
    textAlign: 'center',
  },
  progressText: { marginTop: 7, color: colors.textSoft, fontSize: 14, fontWeight: '700' },
  stamps: { marginTop: 21 },
  rewardBlock: {
    width: '100%',
    marginTop: 28,
    paddingTop: 23,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rewardLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  rewardRow: { marginTop: 2, flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  rewardAmount: { color: colors.text, fontSize: 46, lineHeight: 53, fontWeight: '900', letterSpacing: -1.7 },
  rewardCurrency: { color: colors.accent, fontSize: 17, fontWeight: '900' },
  rewardQualifier: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  readyBadge: {
    minHeight: 29,
    marginTop: 7,
    paddingHorizontal: 13,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  readyText: { color: colors.accentInk, fontSize: 11, fontWeight: '900' },
  rewardDisclaimer: {
    maxWidth: 270,
    marginTop: 11,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: { marginTop: 15, gap: 10 },
  primaryButton: {
    minHeight: 55,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentStrong,
  },
  primaryButtonText: { color: colors.accentInk, fontSize: 15, fontWeight: '900' },
  secondaryButton: {
    minHeight: 49,
    paddingHorizontal: 20,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.textSoft, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  fallback: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  fallbackTitle: { marginTop: 50, color: colors.text, fontSize: 26, fontWeight: '800' },
  fallbackCopy: {
    maxWidth: 310,
    marginTop: 11,
    marginBottom: 25,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
})
