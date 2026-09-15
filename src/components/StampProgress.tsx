import { StyleSheet, Text, View } from 'react-native'
import { colors } from '@/src/theme/colors'

type StampProgressProps = {
  current: number
  total: number
  compact?: boolean
}

export function StampProgress({ current, total, compact = false }: StampProgressProps) {
  return (
    <View accessibilityLabel={`${current} of ${total} stamps collected`} accessibilityRole="summary" style={styles.row}>
      {Array.from({ length: total }, (_, index) => {
        const isComplete = index < current

        return (
          <View
            key={index}
            style={[styles.stamp, compact && styles.stampCompact, isComplete ? styles.completed : styles.incomplete]}
          >
            <Text style={[styles.stampText, compact && styles.stampTextCompact, !isComplete && styles.incompleteText]}>
              {isComplete ? '✓' : index + 1}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stamp: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stampCompact: { width: 31, height: 31, borderRadius: 16 },
  completed: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  incomplete: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  stampText: { color: colors.accentInk, fontSize: 16, fontWeight: '900' },
  stampTextCompact: { fontSize: 13 },
  incompleteText: { color: colors.muted, fontWeight: '700' },
})
