import AsyncStorage from '@react-native-async-storage/async-storage'
import { transact as mwaTransact, type Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { PublicKey } from '@solana/web3.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { toByteArray } from 'react-native-quick-base64'
import { SeekerStatusCard } from '@/src/features/seeker/SeekerStatusCard'
import type { SgtCheckState } from '@/src/features/seeker/sgtRequestController'
import { useSgtCheck } from '@/src/features/seeker/useSgtCheck'
import { isVerifiedSeeker } from '@/src/features/seeker/verifiedSeeker'
import { colors } from '@/src/theme/colors'
import { walletConfig } from './config'
import { getWalletErrorMessage } from './errors'
import { requestSiwsChallenge, SiwsApiError, verifySiwsResult } from './siwsApi'
import { createSiwsAttemptController, type SiwsFlowState } from './siwsAttemptController'
import { appendDiagnosticBreadcrumb, type SiwsDiagnosticBreadcrumb } from './siwsDiagnostics'
import { parseSignInResult, type SiwsChallenge, type WalletControlProof } from './siwsTypes'

const LEGACY_WALLET_UI_CACHE_KEY = 'authorization-cache'

type WalletSession = Readonly<{
  publicAddress: string
  encodedAddress: string
  authToken: string
  walletUriBase: string | null
  identityUri: string
  chain: string
}>

type SessionBoundProof = Readonly<{
  proof: WalletControlProof
  sessionEpoch: number
}>

type ConnectedSessionView = Readonly<{
  address: string
  epoch: number
}>

export function WalletControl() {
  const walletSession = useRef<WalletSession | null>(null)
  const sessionEpoch = useRef(0)
  const [connectedSessionView, setConnectedSessionView] = useState<ConnectedSessionView | null>(null)
  const [publicAddress, setPublicAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showConnectSafety, setShowConnectSafety] = useState(false)
  const [isAuthorizationStateReady, setIsAuthorizationStateReady] = useState(false)
  const [siwsState, setSiwsState] = useState<SiwsFlowState>({ status: 'idle' })
  const [walletControlProof, setWalletControlProof] = useState<SessionBoundProof | null>(null)
  const [verificationNowMs, setVerificationNowMs] = useState(0)
  const [devDiagnostics, setDevDiagnostics] = useState<readonly SiwsDiagnosticBreadcrumb[]>([])
  const devDiagnosticsRef = useRef<readonly SiwsDiagnosticBreadcrumb[]>([])
  const devDiagnosticsMountedRef = useRef(true)
  const siwsController = useRef<ReturnType<typeof createSiwsAttemptController> | null>(null)

  const clearDevDiagnostics = useCallback(() => {
    if (!__DEV__) return
    devDiagnosticsRef.current = []
    setDevDiagnostics([])
  }, [])

  const recordDevDiagnostic = useCallback((breadcrumb: SiwsDiagnosticBreadcrumb) => {
    if (!__DEV__ || !devDiagnosticsMountedRef.current) return
    const next = appendDiagnosticBreadcrumb(devDiagnosticsRef.current, breadcrumb)
    devDiagnosticsRef.current = next
    setDevDiagnostics(next)
  }, [])

  useEffect(() => {
    devDiagnosticsMountedRef.current = true
    const diagnostic = __DEV__ ? recordDevDiagnostic : undefined
    const controller = createSiwsAttemptController({
      getCurrentAddress: () => walletSession.current?.publicAddress ?? null,
      requestChallenge: (address, signal, onDiagnostic) => requestSiwsChallenge(address, signal, { onDiagnostic }),
      authorize: async (challenge, capturedAddress, onDiagnostic) => {
        const session = walletSession.current
        if (session === null || session.publicAddress !== capturedAddress) {
          throw new SiwsFlowError('WALLET_SESSION_CHANGED')
        }
        return authorizeWalletControl(session, challenge, onDiagnostic)
      },
      verify: (address, challenge, result, signal, onDiagnostic) =>
        verifySiwsResult(address, challenge, result, signal, { onDiagnostic }),
      classifyError: (error) => (isWalletCancellation(error) ? 'cancelled' : 'unable'),
      getSafeErrorCode,
      onStateChange: setSiwsState,
      onProofChange: (proof) => {
        setVerificationNowMs(Date.now())
        setWalletControlProof(proof === null ? null : { proof, sessionEpoch: sessionEpoch.current })
      },
      onDiagnostic: diagnostic,
      onDiagnosticsReset: __DEV__ ? clearDevDiagnostics : undefined,
    })
    siwsController.current = controller
    return () => {
      controller.invalidate(false, false)
      siwsController.current = null
      devDiagnosticsRef.current = []
      devDiagnosticsMountedRef.current = false
    }
  }, [clearDevDiagnostics, recordDevDiagnostic])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setVerificationNowMs(Date.now())
      }
    })
    return () => subscription.remove()
  }, [])

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
  const connectedAddress = connectedSessionView?.address === publicAddress ? publicAddress : null
  const sgtState = useSgtCheck(connectedAddress)
  const visibleSgtState: SgtCheckState =
    connectedAddress === null
      ? { status: 'idle' }
      : sgtState.status !== 'idle' && sgtState.address === connectedAddress
        ? sgtState
        : { status: 'checking', address: connectedAddress }
  const verifiedSeeker = isVerifiedSeeker({
    connectedAddress,
    sessionAddress: connectedSessionView?.address ?? null,
    sessionEpoch: connectedSessionView?.epoch ?? 0,
    sgtState,
    siwsState,
    siwsProof: walletControlProof?.proof ?? null,
    proofSessionEpoch: walletControlProof?.sessionEpoch ?? null,
    nowMs: verificationNowMs,
  })

  const connectWallet = async () => {
    if (!isAuthorizationStateReady) {
      return
    }

    setIsConnecting(true)
    setFeedback(null)
    clearDevDiagnostics()
    recordDevDiagnostic('IDENTITY_ASSOCIATION_STARTED')
    recordDevDiagnostic('IDENTITY_ROUTE_GENERIC')

    try {
      const authorizationResult = await mwaTransact(async (wallet: Web3MobileWallet) => {
        recordDevDiagnostic('MWA_SESSION_CONNECTED')
        return wallet.authorize({
          chain: walletConfig.chain,
          identity: walletConfig.identity,
        })
      })
      const nextSession = createWalletSession(authorizationResult)

      sessionEpoch.current += 1
      siwsController.current?.invalidate()
      walletSession.current = nextSession
      setConnectedSessionView({ address: nextSession.publicAddress, epoch: sessionEpoch.current })
      setPublicAddress(nextSession.publicAddress)
      setSiwsState({ status: 'idle' })
    } catch (error: unknown) {
      recordDevDiagnostic(isWalletCancellation(error) ? 'MWA_CONNECT_CANCELLED' : 'MWA_CONNECT_FAILED_SAFE')
      setFeedback(getWalletErrorMessage(error))
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectFromStampd = () => {
    sessionEpoch.current += 1
    siwsController.current?.invalidate()
    walletSession.current = null
    setConnectedSessionView(null)
    setPublicAddress(null)
    setFeedback(null)
    setSiwsState({ status: 'idle' })
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
        <SeekerStatusCard state={visibleSgtState} />
        {__DEV__ && (
          <WalletControlVerification
            diagnostics={devDiagnostics}
            onCancel={() => siwsController.current?.cancelSafety()}
            onContinue={() => void siwsController.current?.continueVerification()}
            onStart={() => siwsController.current?.requestVerification()}
            proof={walletControlProof?.proof ?? null}
            state={siwsState}
          />
        )}
        {__DEV__ && verifiedSeeker && (
          <View accessibilityLiveRegion="polite" style={styles.verifiedSeekerCard}>
            <Text style={styles.verifiedSeekerTitle}>Verified Seeker</Text>
            <Text style={styles.verifiedSeekerDetail}>SGT and wallet control match this address.</Text>
          </View>
        )}
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
      {__DEV__ && devDiagnostics.length > 0 && <DevelopmentDiagnostics breadcrumbs={devDiagnostics} />}

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
    encodedAddress,
    authToken: authorizationResult.auth_token,
    walletUriBase: validateWalletUriBase(authorizationResult.wallet_uri_base),
    identityUri: walletConfig.identity.uri,
    chain: walletConfig.chain,
  }
}

async function authorizeWalletControl(
  session: WalletSession,
  challenge: SiwsChallenge,
  onDiagnostic?: (breadcrumb: SiwsDiagnosticBreadcrumb) => void,
) {
  const associationConfig = session.walletUriBase === null ? undefined : { baseUri: session.walletUriBase }
  onDiagnostic?.(session.walletUriBase === null ? 'SIWS_ROUTE_GENERIC' : 'SIWS_ROUTE_ENDPOINT_SPECIFIC')
  onDiagnostic?.('MWA_AUTHORIZE_STARTED')
  const authorizationResult = await mwaTransact(async (wallet: Web3MobileWallet) => {
    return wallet.authorize({
      chain: walletConfig.chain,
      identity: walletConfig.identity,
      addresses: [session.encodedAddress],
      ...(session.walletUriBase === null ? {} : { auth_token: session.authToken }),
      sign_in_payload: challenge,
    })
  }, associationConfig)
  onDiagnostic?.('MWA_AUTHORIZE_RETURNED')

  const result = parseSignInResult(
    authorizationResult.sign_in_result,
    authorizationResult.accounts,
    session.publicAddress,
    onDiagnostic,
  )
  if (result === null) {
    throw new SiwsFlowError('INVALID_SIGN_IN_RESULT')
  }
  return result
}

function WalletControlVerification(props: {
  state: SiwsFlowState
  proof: WalletControlProof | null
  diagnostics: readonly SiwsDiagnosticBreadcrumb[]
  onStart: () => void
  onContinue: () => void
  onCancel: () => void
}) {
  const isPending = ['requesting_challenge', 'opening_wallet', 'verifying'].includes(props.state.status)
  const pendingLabel =
    props.state.status === 'requesting_challenge'
      ? 'Requesting Challenge…'
      : props.state.status === 'opening_wallet'
        ? 'Opening Wallet / Signing…'
        : 'Verifying…'

  return (
    <View style={styles.verificationCard}>
      {props.proof !== null && props.state.status === 'verified' ? (
        <>
          <Text style={styles.verificationTitle}>Wallet Control Verified</Text>
          <Text style={styles.verificationBody}>Your wallet-control signature was verified by Stampd.</Text>
        </>
      ) : (
        <>
          <Text style={styles.verificationTitle}>
            {props.state.status === 'unable' ? 'Unable to Verify Wallet Control' : 'Ownership Verification Required'}
          </Text>
          <Text style={styles.verificationBody}>
            {props.state.status === 'cancelled'
              ? 'Verification was cancelled. You can try again when ready.'
              : props.state.status === 'unable' && props.state.code === 'CHALLENGE_EXPIRED'
                ? 'Verification expired. Please try again.'
                : 'Development diagnostic · Wallet control only · No Seeker status is granted.'}
          </Text>
          {props.state.status === 'unable' && props.diagnostics.length > 0 && (
            <DevelopmentDiagnostics breadcrumbs={props.diagnostics} />
          )}
          <Pressable
            accessibilityRole="button"
            disabled={isPending}
            onPress={props.onStart}
            style={({ pressed }) => [styles.verifyButton, pressed && styles.pressed, isPending && styles.busy]}
          >
            {isPending && <ActivityIndicator color={colors.accentInk} size="small" />}
            <Text style={styles.verifyButtonText}>{isPending ? pendingLabel : 'Verify Wallet Control'}</Text>
          </Pressable>
        </>
      )}

      <Modal
        animationType="slide"
        onRequestClose={props.onCancel}
        statusBarTranslucent
        transparent
        visible={props.state.status === 'safety'}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.safetySheet}>
            <Text style={styles.safetyTitle}>Verify Wallet Control</Text>
            <Text style={styles.safetyBody}>
              {
                'Stampd will ask your wallet to sign a message confirming that you control this public address.\n\nThis is not a transaction.\nNo SOL, tokens, or SKR will be transferred.\nThere is no network fee.\n\nThe verification request expires in five minutes.'
              }
            </Text>
            <View style={styles.safetyActions}>
              <Pressable
                accessibilityHint="Requests a challenge and opens the connected wallet for message signing"
                accessibilityRole="button"
                onPress={props.onContinue}
                style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
              >
                <Text style={styles.continueText}>Continue</Text>
              </Pressable>
              <Pressable
                accessibilityHint="Closes this message without contacting the verification service or wallet"
                accessibilityRole="button"
                onPress={props.onCancel}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function DevelopmentDiagnostics(props: { breadcrumbs: readonly SiwsDiagnosticBreadcrumb[] }) {
  return (
    <View style={styles.diagnosticCard}>
      <Text style={styles.diagnosticLabel}>Diagnostic:</Text>
      <Text selectable style={styles.diagnosticValue}>
        {props.breadcrumbs.join(' → ')}
      </Text>
    </View>
  )
}

class SiwsFlowError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'SiwsFlowError'
    this.code = code
  }
}

function isWalletCancellation(error: unknown): boolean {
  const code = getErrorCode(error)
  return code === 'ERROR_ASSOCIATION_CANCELLED' || code === 'ERROR_SESSION_CLOSED' || code === -1 || code === -3
}

function getSafeErrorCode(error: unknown): string {
  if (error instanceof SiwsApiError || error instanceof SiwsFlowError) {
    return error.code
  }
  const code = getErrorCode(error)
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'WALLET_CONTROL_FAILED'
}

function getErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }
  return (error as { code?: unknown }).code
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
  verificationCard: {
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  verificationTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  verificationBody: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  verifiedSeekerCard: {
    alignSelf: 'stretch',
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.backgroundRaised,
    gap: 4,
  },
  verifiedSeekerTitle: { color: colors.accent, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  verifiedSeekerDetail: { color: colors.textSoft, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  diagnosticCard: {
    alignSelf: 'stretch',
    padding: 9,
    borderRadius: 12,
    backgroundColor: colors.backgroundRaised,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  diagnosticLabel: { color: colors.muted, fontSize: 9, lineHeight: 12, fontWeight: '800' },
  diagnosticValue: { color: colors.textSoft, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  verifyButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.accent,
  },
  verifyButtonText: { color: colors.accentInk, fontSize: 11, fontWeight: '900' },
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
