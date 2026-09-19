import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/src/theme/colors'
import { getSeekerStatusCopy } from './statusCopy'
import { useSgtCheck } from './useSgtCheck'

type SeekerStatusCardProps = Readonly<{
  walletAddress: string
}>

export function SeekerStatusCard({ walletAddress }: SeekerStatusCardProps) {
  const state = useSgtCheck(walletAddress)
  const copy = getSeekerStatusCopy(state)

  if (copy === null) {
    return null
  }

  return (
    <View accessibilityLiveRegion="polite" style={styles.card}>
      <Text style={styles.label}>Seeker Status</Text>
      <View style={styles.statusRow}>
        {state.status === 'checking' && <ActivityIndicator color={colors.accent} size="small" />}
        <Text style={styles.headline}>{copy.headline}</Text>
      </View>
      {copy.detail !== null && <Text style={styles.detail}>{copy.detail}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 13,
    borderRadius: 17,
    backgroundColor: colors.backgroundRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headline: { color: colors.accent, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  detail: { color: colors.textSoft, fontSize: 11, lineHeight: 16, fontWeight: '600' },
})
