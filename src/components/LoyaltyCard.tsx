import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { LoyaltyMerchant } from '@/src/data/mockLoyalty'
import { colors } from '@/src/theme/colors'
import { StampProgress } from './StampProgress'

type LoyaltyCardProps = {
  merchant: LoyaltyMerchant
  featured?: boolean
  onPress?: () => void
}

export function LoyaltyCard({ merchant, featured = false, onPress }: LoyaltyCardProps) {
  const remaining = merchant.stamps.total - merchant.stamps.current
  const percent = Math.round((merchant.stamps.current / merchant.stamps.total) * 100)

  return (
    <Pressable
      accessibilityHint={onPress ? `Opens ${merchant.name} demo eligibility details` : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, featured ? styles.featured : styles.compact, pressed && styles.pressed]}
    >
      {featured && <View pointerEvents="none" style={styles.cardGlow} />}

      <View style={styles.topRow}>
        <View style={styles.merchantCopy}>
          <Text style={styles.category}>{merchant.category.toUpperCase()}</Text>
          <Text style={[styles.name, featured && styles.featuredName]}>{merchant.name}</Text>
        </View>
        {featured && <Text style={styles.arrow}>↗</Text>}
      </View>

      <View style={featured ? styles.featuredProgress : styles.compactProgress}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressValue}>
            {merchant.stamps.current} / {merchant.stamps.total} stamps
          </Text>
        </View>
        <StampProgress compact={!featured} current={merchant.stamps.current} total={merchant.stamps.total} />
      </View>

      {featured ? (
        <>
          <View style={styles.rewardRow}>
            <View>
              <Text style={styles.rewardLabel}>DEMO REWARD TARGET</Text>
              <Text style={styles.rewardValue}>
                {merchant.reward.amount} {merchant.reward.currency} target
              </Text>
            </View>
            <Text style={styles.percent}>{percent}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${percent}%` }]} />
          </View>
        </>
      ) : (
        <Text style={styles.unlockMessage}>
          {remaining === 0 ? 'Eligibility Ready · Demo' : `${remaining} more stamps for demo eligibility`}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  featured: {
    padding: 22,
    borderRadius: 26,
    backgroundColor: colors.surfaceStrong,
  },
  compact: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  cardGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -105,
    right: -75,
    backgroundColor: colors.glow,
    opacity: 0.1,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  merchantCopy: { flex: 1, paddingRight: 12 },
  category: {
    color: colors.accent,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  name: {
    marginTop: 5,
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  featuredName: { fontSize: 27, lineHeight: 32, letterSpacing: -1 },
  arrow: { color: colors.accent, fontSize: 22, fontWeight: '700' },
  featuredProgress: { marginTop: 28, gap: 13 },
  compactProgress: { marginTop: 19, gap: 11 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  progressLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  progressValue: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  rewardRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  rewardLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  rewardValue: { marginTop: 3, color: colors.text, fontSize: 20, fontWeight: '800' },
  percent: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  barTrack: {
    height: 7,
    marginTop: 12,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.backgroundRaised,
  },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accentStrong },
  unlockMessage: { marginTop: 17, color: colors.textSoft, fontSize: 13, fontWeight: '600' },
})
