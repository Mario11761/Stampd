import { router, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StampProgress } from '@/src/components/StampProgress'
import { getSeekerCoffee, mockMerchants, seekerCoffee } from '@/src/data/mockLoyalty'
import { useDemoLoyalty } from '@/src/features/stamps/DemoLoyaltyContext'
import { colors } from '@/src/theme/colors'

export default function RewardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { isDemoStampCollected } = useDemoLoyalty()
  const baseMerchant = mockMerchants.find((item) => item.id === id) ?? seekerCoffee
  const merchant = baseMerchant.id === 'seeker-coffee' ? getSeekerCoffee(isDemoStampCollected) : baseMerchant
  const isReady = merchant.id === 'seeker-coffee' && isDemoStampCollected

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.glow} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.category}>{merchant.category.toUpperCase()}</Text>
          <Text style={styles.title}>{merchant.name}</Text>
          <Text style={styles.progressText}>
            {merchant.stamps.current} / {merchant.stamps.total} stamps
          </Text>
        </View>

        <View style={styles.rewardPanel}>
          <Text style={styles.panelLabel}>DEMO REWARD TARGET</Text>
          <View style={styles.rewardValueRow}>
            <Text style={styles.rewardAmount}>{merchant.reward.amount}</Text>
            <Text style={styles.rewardCurrency}>{merchant.reward.currency}</Text>
          </View>
          <View style={[styles.statusBadge, isReady && styles.statusBadgeReady]}>
            <View style={[styles.statusDot, isReady && styles.statusDotReady]} />
            <Text style={[styles.statusText, isReady && styles.statusTextReady]}>
              {isReady ? 'Eligibility Ready · Demo' : 'Eligibility Locked · Demo'}
            </Text>
          </View>

          <View style={styles.stampsBlock}>
            <StampProgress current={merchant.stamps.current} total={merchant.stamps.total} />
          </View>
        </View>

        <View style={styles.detailsCard}>
          <DetailRow label="Program" value={merchant.name} />
          <DetailRow label="Requirement" value={`${merchant.stamps.total} / ${merchant.stamps.total} stamps`} />
          <DetailRow label="Demo target" value={`${merchant.reward.amount} ${merchant.reward.currency}`} />
          <DetailRow label="Status" value={isReady ? 'Eligibility Ready · Demo' : 'Eligibility Locked · Demo'} last />
        </View>

        <View style={styles.note}>
          <Text style={styles.noteLabel}>LOCAL DEMO</Text>
          <Text style={styles.noteText}>
            {isReady
              ? 'Your local demo eligibility is complete. No SKR has been transferred or claimed.'
              : 'Collect the remaining local demo stamps to complete eligibility. No SKR has been transferred or claimed.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    top: -170,
    right: -170,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: colors.glow,
    opacity: 0.11,
  },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 17, paddingBottom: 34 },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 40 },
  pressed: { opacity: 0.65 },
  backArrow: { color: colors.accent, fontSize: 24, lineHeight: 28 },
  backLabel: { color: colors.textSoft, fontSize: 13, fontWeight: '700' },
  header: { marginTop: 29 },
  category: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: {
    marginTop: 7,
    color: colors.text,
    fontSize: 40,
    lineHeight: 45,
    fontWeight: '800',
    letterSpacing: -1.7,
  },
  progressText: { marginTop: 9, color: colors.textSoft, fontSize: 15, fontWeight: '700' },
  rewardPanel: {
    marginTop: 32,
    padding: 24,
    borderRadius: 28,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  rewardValueRow: { marginTop: 3, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rewardAmount: { color: colors.text, fontSize: 54, lineHeight: 61, fontWeight: '900', letterSpacing: -2 },
  rewardCurrency: { color: colors.accent, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 11,
    minHeight: 29,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.backgroundRaised,
  },
  statusBadgeReady: { backgroundColor: colors.accent },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted },
  statusDotReady: { backgroundColor: colors.accentInk },
  statusText: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  statusTextReady: { color: colors.accentInk },
  stampsBlock: { marginTop: 31 },
  detailsCard: {
    marginTop: 20,
    paddingHorizontal: 19,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  detailRow: {
    minHeight: 51,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  detailValue: { flexShrink: 1, color: colors.text, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  note: { marginTop: 27, paddingTop: 21, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  noteLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  noteText: { marginTop: 8, color: colors.textSoft, fontSize: 13, lineHeight: 20, fontWeight: '500' },
})
