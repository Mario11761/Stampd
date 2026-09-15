import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { DemoLoyaltyProvider } from '@/src/features/stamps/DemoLoyaltyContext'
import { colors } from '@/src/theme/colors'

export default function RootLayout() {
  return (
    <DemoLoyaltyProvider>
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="passport" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="rewards" options={{ headerShown: false }} />
        <Stack.Screen name="reward/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="stamp-success" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </DemoLoyaltyProvider>
  )
}
