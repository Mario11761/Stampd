import AsyncStorage from '@react-native-async-storage/async-storage'
import { transact as mwaTransact, type Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { PublicKey } from '@solana/web3.js'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { toByteArray } from 'react-native-quick-base64'
import { colors } from '@/src/theme/colors'
import { walletConfig } from './config'
import { getWalletErrorMessage } from './errors'

const LEGACY_WALLET_UI_CACHE_KEY = 'authorization-cache'

type WalletSession = Readonly<{
  publicAddress: string
  authToken: string
  walletUriBase: string | null
  identityUri: string
  chain: string
}>

export function WalletControl() {
  const walletSession = useRef<WalletSession | null>(null)
  const [publicAddress, setPublicAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showConnectSafety, setShowConnectSafety] = useState(false)
  const [isAuthorizationStateReady, setIsAuthorizationStateReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    walletSession.current = null

    void AsyncStorage.removeItem(LEGACY_WALLET_UI_CACHE_KEY)
      .then(() => {
        if (isMounted) {
          setPublicAddress(null)
          setIsAuthorizationStateReady(true)
        }
      })
      .catch(() => {
        if (isMounted) {
          setPublicAddress(null)
          setFeedback('Unable to prepare a fresh wallet session. Please restart Stampd.')
        }
      })

    return () => {
      isMounted = false
      walletSession.current = null
    }
  }, [])

  const isBusy = isConnecting || !isAuthorizationStateReady

  const connectWallet = async () => {
    if (!isAuthorizationStateReady) {
      return
    }

    setIsConnecting(true)
    setFeedback(null)

    try {
      const authorizationResult = await mwaTransact(async (wallet: Web3MobileWallet) => {
        return wallet.authorize({
          chain: walletConfig.chain,
          identity: walletConfig.identity,
        })
      })
      const nextSession = createWalletSession(authorizationResult)

      walletSession.current = nextSession
      setPublicAddress(nextSession.publicAddress)
    } catch (error: unknown) {
      setFeedback(getWalletErrorMessage(error))
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectFromStampd = () => {
    walletSession.current = null
    setPublicAddress(null)
    setFeedback(null)
  }

  if (publicAddress) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.connectedPill}>
          <View style={styles.connectedStatus}>
            <View style={styles.statusDot} />
            <View style={styles.addressCopy}>
              <Text style={styles.connectedLabel}>Wallet Connected</Text>
              <Text selectable style={styles.address}>
                {shortenAddress(publicAddress)}
              </Text>
              <Text style={styles.connectionNote}>Devnet · Public address only</Text>
              <Text style={styles.connectionNote}>No transaction requested</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={disconnectFromStampd}
            style={({ pressed }) => [styles.disconnectButton, pressed && styles.pressed]}
          >
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </View>
        <Text style={styles.sessionHelp}>Disconnect ends this Stampd session.</Text>
      </View>
    )
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityHint="Shows Stampd's wallet safety information before opening a compatible wallet"
        accessibilityRole="button"
        disabled={isBusy}
        onPress={() => setShowConnectSafety(true)}
        style={({ pressed }) => [styles.connectButton, pressed && styles.pressed, isBusy && styles.busy]}
      >
        {isConnecting ? (
          <>
            <ActivityIndicator color={colors.accentInk} size="small" />
            <Text style={styles.connectText}>Connecting…</Text>
          </>
        ) : (
          <>
            <View style={styles.walletGlyph}>
              <View style={styles.walletGlyphLine} />
            </View>
            <Text style={styles.connectText}>Connect Wallet</Text>
          </>
        )}
      </Pressable>
      {feedback && <Text style={styles.feedback}>{feedback}</Text>}

      <Modal
        animationType="slide"
        onRequestClose={() => setShowConnectSafety(false)}
        statusBarTranslucent
        transparent
        visible={showConnectSafety}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.safetySheet}>
            <Text style={styles.safetyTitle}>Connect Wallet Safely</Text>
            <Text style={styles.safetyBody}>
              {'Stampd uses your wallet only to identify your loyalty passport.\nYour wallet remains in control.'}
            </Text>

            <ScrollView
              contentContainerStyle={styles.safetyScrollContent}
              showsVerticalScrollIndicator={false}
              style={styles.safetyScroll}
            >
              <View style={styles.safetyItems}>
                <Text style={styles.safetyItem}>✓ Public wallet address only</Text>
                <Text style={styles.safetyItem}>✓ Devnet only</Text>
                <Text style={styles.safetyItem}>✓ No seed phrase or private key access</Text>
                <Text style={styles.safetyItem}>✓ No automatic signing</Text>
                <Text style={styles.safetyItem}>✓ No automatic transfers</Text>
                <Text style={styles.safetyItem}>✓ No transaction requested at this stage</Text>
                <Text style={styles.safetyItem}>✓ Future transactions require explicit wallet approval</Text>
                <Text style={styles.safetyItem}>✓ Session credentials are not stored permanently</Text>
              </View>

              <View style={styles.cannotCard}>
                <Text style={styles.cannotTitle}>Stampd cannot</Text>
                <Text style={styles.cannotItem}>• Access your seed phrase</Text>
                <Text style={styles.cannotItem}>• Export your private key</Text>
                <Text style={styles.cannotItem}>• Silently sign transactions</Text>
                <Text style={styles.cannotItem}>• Automatically move funds</Text>
              </View>
            </ScrollView>

            <View style={styles.safetyActions}>
              <Pressable
                accessibilityHint="Closes this message and opens the Android wallet chooser"
                accessibilityRole="button"
                onPress={() => {
                  setShowConnectSafety(false)
                  void connectWallet()
                }}
                style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
              >
                <Text style={styles.continueText}>Continue to Wallet</Text>
              </Pressable>

              <Pressable
                accessibilityHint="Closes this message without opening a wallet"
                accessibilityRole="button"
                onPress={() => setShowConnectSafety(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Text style={styles.safetyFooter}>Non-custodial by design. Your wallet stays in control.</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address
  }

  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function createWalletSession(authorizationResult: {
  accounts: readonly { address: string }[]
  auth_token: string
  wallet_uri_base?: string
}): WalletSession {
  const encodedAddress = authorizationResult.accounts[0]?.address

  if (!encodedAddress || !authorizationResult.auth_token) {
    throw new Error('Wallet authorization did not return a usable session.')
  }

  return {
    publicAddress: new PublicKey(toByteArray(encodedAddress)).toBase58(),
    authToken: authorizationResult.auth_token,
    walletUriBase: validateWalletUriBase(authorizationResult.wallet_uri_base),
    identityUri: walletConfig.identity.uri,
    chain: walletConfig.chain,
  }
}

function validateWalletUriBase(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 2048 ||
    value !== value.trim() ||
    !value.startsWith('https://')
  ) {
    return null
  }

  try {
    const uri = new URL(value)

    if (
      uri.protocol !== 'https:' ||
      uri.hostname.length === 0 ||
      uri.username.length > 0 ||
      uri.password.length > 0 ||
      uri.search.length > 0 ||
      uri.hash.length > 0
    ) {
      return null
    }

    return value
  } catch {
    return null
  }
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch', gap: 8 },
  connectButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.accentStrong,
  },
  busy: { opacity: 0.8 },
  pressed: { opacity: 0.72 },
  connectText: { color: colors.accentInk, fontSize: 13, fontWeight: '900' },
  walletGlyph: {
    width: 18,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.accentInk,
    justifyContent: 'center',
  },
  walletGlyphLine: {
    alignSelf: 'flex-end',
    width: 5,
    height: 3,
    marginRight: 2,
    borderRadius: 2,
    backgroundColor: colors.accentInk,
  },
  connectedPill: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectedStatus: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentStrong },
  addressCopy: { minWidth: 0 },
  connectedLabel: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  address: { marginTop: 3, color: colors.textSoft, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  connectionNote: { marginTop: 2, color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  disconnectButton: {
    minWidth: 82,
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundRaised,
  },
  disconnectText: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  sessionHelp: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  feedback: { color: colors.textSoft, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  safetySheet: {
    maxHeight: '94%',
    padding: 18,
    borderRadius: 26,
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  safetyTitle: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  safetyBody: { color: colors.textSoft, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  safetyScroll: { flexShrink: 1 },
  safetyScrollContent: { gap: 12, paddingVertical: 2 },
  safetyItems: { gap: 6 },
  safetyItem: { color: colors.accent, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  cannotCard: {
    gap: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.backgroundRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cannotTitle: { marginBottom: 2, color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: '900' },
  cannotItem: { color: colors.textSoft, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  safetyActions: { gap: 8 },
  continueButton: {
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentStrong,
  },
  continueText: { color: colors.accentInk, fontSize: 14, fontWeight: '900' },
  cancelButton: {
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundRaised,
  },
  cancelText: { color: colors.textSoft, fontSize: 13, fontWeight: '800' },
  safetyFooter: { color: colors.muted, fontSize: 10, lineHeight: 14, textAlign: 'center', fontWeight: '700' },
})
