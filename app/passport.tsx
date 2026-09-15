import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BrandMark } from '@/src/components/BrandMark'
import { LoyaltyCard } from '@/src/components/LoyaltyCard'
import { ProductShell } from '@/src/components/ProductShell'
import { StatCard } from '@/src/components/StatCard'
import { getSeekerCoffee, mockUser, pixelCards } from '@/src/data/mockLoyalty'
import { useDemoLoyalty } from '@/src/features/stamps/DemoLoyaltyContext'
import { WalletControl } from '@/src/features/wallet/WalletControl'
import { colors } from '@/src/theme/colors'

export default function PassportScreen() {
  const { isDemoStampCollected, resetDemoStamp } = useDemoLoyalty()
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const seekerCoffee = getSeekerCoffee(isDemoStampCollected)
  const totalStamps = mockUser.stats.stamps + (isDemoStampCollected ? 1 : 0)

  const handleDemoReset = async () => {
    const result = await resetDemoStamp()
    setResetMessage(result === 'RESET' ? 'Demo reset.' : 'Demo reset failed. Please try again.')
  }

  return (
    <ProductShell activeTab="passport">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandMark compact />

        <View style={styles.intro}>
          <Text style={styles.greeting}>{mockUser.greeting}</Text>
          <View style={styles.passportRow}>
            <Text style={styles.title}>{mockUser.passportName}</Text>
            <WalletControl />
          </View>
        </View>

        <View style={styles.stats}>
          <StatCard label="Stamps" value={totalStamps} />
          <StatCard label="Places" value={mockUser.stats.places} />
          <StatCard label="SKR Earned" value={mockUser.stats.skrEarned} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MY PASSPORT</Text>
          <LoyaltyCard
            featured
            merchant={seekerCoffee}
            onPress={() =>
              router.push({
                pathname: '/reward/[id]',
                params: { id: seekerCoffee.id },
              })
            }
          />
          <LoyaltyCard merchant={pixelCards} />

          {__DEV__ && (
            <Pressable
              accessibilityHint="Deletes only the local Seeker Coffee Stage 4 demo stamp"
              accessibilityRole="button"
              onPress={() => void handleDemoReset()}
              style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}
            >
              <Text style={styles.resetLabel}>DEV ONLY</Text>
              <Text style={styles.resetText}>Reset Seeker Coffee Demo</Text>
            </Pressable>
          )}
          {__DEV__ && resetMessage && <Text style={styles.resetMessage}>{resetMessage}</Text>}
        </View>
      </ScrollView>
    </ProductShell>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 },
  intro: { marginTop: 34 },
  greeting: { color: colors.textSoft, fontSize: 15, fontWeight: '600' },
  passportRow: { marginTop: 7, gap: 13, alignItems: 'flex-start' },
  title: {
    color: colors.text,
    fontSize: 33,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1.3,
  },
  stats: { marginTop: 27, flexDirection: 'row', gap: 9 },
  section: { marginTop: 35, gap: 14 },
  sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  resetButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundRaised,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  resetButtonPressed: { opacity: 0.7 },
  resetLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  resetText: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  resetMessage: { marginTop: -6, color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
})
