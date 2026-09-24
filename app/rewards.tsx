import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { BrandMark } from '@/src/components/BrandMark'
import { ProductShell } from '@/src/components/ProductShell'
import { RewardCard } from '@/src/components/RewardCard'
import { getSeekerCoffee } from '@/src/data/mockLoyalty'
import { useDemoLoyalty } from '@/src/features/stamps/DemoLoyaltyContext'
import { colors } from '@/src/theme/colors'

export default function RewardsScreen() {
  const { isDemoStampCollected } = useDemoLoyalty()
  const seekerCoffee = getSeekerCoffee(isDemoStampCollected)

  return (
    <ProductShell activeTab="rewards">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandMark compact />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>REWARDS</Text>
          <Text style={styles.title}>Demo Reward Eligibility</Text>
          <Text style={styles.description}>Track local demo eligibility from your Stampd places.</Text>
          <Text style={styles.disclaimer}>No SKR has been transferred or claimed.</Text>
        </View>

        <View style={styles.list}>
          <RewardCard
            merchant={seekerCoffee}
            onPress={() => router.push({ pathname: '/reward/[id]', params: { id: seekerCoffee.id } })}
            ready={isDemoStampCollected}
          />
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>＋</Text>
            <Text style={styles.emptyTitle}>More demo programs ahead</Text>
            <Text style={styles.emptyCopy}>New merchant eligibility programs will appear here.</Text>
          </View>
        </View>
      </ScrollView>
    </ProductShell>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36 },
  header: { marginTop: 40 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: {
    marginTop: 8,
    color: colors.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  description: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  disclaimer: { marginTop: 7, color: colors.textSoft, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  list: { marginTop: 30, gap: 14 },
  emptyCard: {
    minHeight: 155,
    padding: 22,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyIcon: { color: colors.muted, fontSize: 24, lineHeight: 28 },
  emptyTitle: { marginTop: 7, color: colors.textSoft, fontSize: 15, fontWeight: '800' },
  emptyCopy: { marginTop: 5, color: colors.muted, fontSize: 12, fontWeight: '500' },
})
