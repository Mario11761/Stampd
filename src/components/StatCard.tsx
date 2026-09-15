import { StyleSheet, Text, View } from 'react-native'
import { colors } from '@/src/theme/colors'

type StatCardProps = {
  value: number
  label: string
}

export function StatCard({ value, label }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  value: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  label: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
})
