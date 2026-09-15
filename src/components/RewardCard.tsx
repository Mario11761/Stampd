import { StyleSheet, Text, View } from 'react-native'
import type { LoyaltyMerchant } from '@/src/data/mockLoyalty'
import { colors } from '@/src/theme/colors'

type RewardCardProps = {
  merchant: LoyaltyMerchant
  ready?: boolean
}

export function RewardCard({ merchant, ready = false }: RewardCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>✦</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{merchant.name}</Text>
        <Text style={[styles.status, ready && styles.statusReady]}>
          {ready ? 'Reward Ready' : 'Locked / Not Ready'}
        </Text>
      </View>
      <View style={styles.valueBlock}>
        <Text style={styles.value}>{merchant.reward.amount}</Text>
        <Text style={styles.currency}>{merchant.reward.currency}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
  },
  iconText: { color: colors.accent, fontSize: 24 },
  copy: { flex: 1, minWidth: 0, marginHorizontal: 14 },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  status: { marginTop: 4, color: colors.muted, fontSize: 12, fontWeight: '600' },
  statusReady: { color: colors.accent },
  valueBlock: { alignItems: 'flex-end' },
  value: { color: colors.accent, fontSize: 23, lineHeight: 25, fontWeight: '900' },
  currency: { color: colors.textSoft, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
})
