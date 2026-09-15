import { StyleSheet, Text, View } from 'react-native'
import { colors } from '@/src/theme/colors'

type BrandMarkProps = {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <View style={[styles.markInner, compact && styles.markInnerCompact]} />
      </View>
      <Text style={[styles.wordmark, compact && styles.wordmarkCompact]}>Stampd</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
  },
  markCompact: { width: 29, height: 29, borderRadius: 9 },
  markInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  markInnerCompact: { width: 10, height: 10, borderRadius: 5 },
  wordmark: { color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.7 },
  wordmarkCompact: { fontSize: 22 },
})
