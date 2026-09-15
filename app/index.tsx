import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandMark } from '@/src/components/BrandMark'
import { colors } from '@/src/theme/colors'

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View pointerEvents="none" style={styles.glow} />

      <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandMark />

        <View style={styles.hero}>
          <View style={styles.copy}>
            <Text style={styles.title}>Your onchain{`\n`}loyalty passport.</Text>
            <Text style={styles.tagline}>Scan. Sign. Stamp. Earn.</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityHint="Opens your mock loyalty passport"
              accessibilityRole="button"
              onPress={() => router.push('/passport')}
              style={({ pressed }) => [styles.enterButton, pressed && styles.enterButtonPressed]}
            >
              <Text style={styles.enterButtonText}>Enter Stampd</Text>
              <Text style={styles.enterArrow}>→</Text>
            </Pressable>

            <View style={styles.footer}>
              <View style={styles.footerLine} />
              <Text style={styles.footerText}>BUILT FOR SEEKER</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    top: -180,
    right: -190,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: colors.glow,
    opacity: 0.2,
  },
  content: {
    flexGrow: 1,
    minHeight: '100%',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  hero: { flex: 1, minHeight: 530, justifyContent: 'space-between', paddingTop: 70 },
  copy: { gap: 20 },
  title: {
    color: colors.text,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '700',
    letterSpacing: -1.9,
  },
  tagline: {
    color: colors.accent,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  actions: { gap: 23, paddingTop: 48 },
  enterButton: {
    minHeight: 60,
    paddingHorizontal: 21,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentStrong,
  },
  enterButtonPressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  enterButtonText: { color: colors.accentInk, fontSize: 16, fontWeight: '900' },
  enterArrow: { color: colors.accentInk, fontSize: 23, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerLine: { width: 28, height: 1, backgroundColor: colors.muted },
  footerText: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
})
