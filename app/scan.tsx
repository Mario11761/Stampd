import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { BrandMark } from '@/src/components/BrandMark'
import { ProductShell } from '@/src/components/ProductShell'
import { useDemoLoyalty } from '@/src/features/stamps/DemoLoyaltyContext'
import { parseDemoStamp } from '@/src/features/stamps/demoStamp'
import { colors } from '@/src/theme/colors'

type ScanFeedback = 'idle' | 'invalid' | 'processing' | 'duplicate' | 'storage-error'

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const { collectDemoStamp, isReady } = useDemoLoyalty()
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [feedback, setFeedback] = useState<ScanFeedback>('idle')
  const scanGateRef = useRef(false)
  const invalidResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useFocusEffect(
    useCallback(() => {
      setIsCameraActive(true)

      return () => {
        setIsCameraActive(false)
      }
    }, []),
  )

  useEffect(
    () => () => {
      if (invalidResetTimerRef.current) {
        clearTimeout(invalidResetTimerRef.current)
      }
    },
    [],
  )

  const resetScanner = useCallback(() => {
    scanGateRef.current = false
    setFeedback('idle')
  }, [])

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scanGateRef.current || !isReady) {
        return
      }

      scanGateRef.current = true
      const parsed = parseDemoStamp(data)

      if (!parsed.accepted) {
        setFeedback('invalid')
        invalidResetTimerRef.current = setTimeout(() => {
          scanGateRef.current = false
          setFeedback('idle')
        }, 1400)
        return
      }

      setFeedback('processing')
      const result = await collectDemoStamp()

      if (result === 'COLLECTED') {
        router.replace('/stamp-success')
        return
      }

      if (result === 'DUPLICATE') {
        setFeedback('duplicate')
        return
      }

      setFeedback('storage-error')
    },
    [collectDemoStamp, isReady],
  )

  const goBack = () => router.replace('/passport')

  if (!permission) {
    return (
      <ProductShell activeTab="scan">
        <View style={styles.content}>
          <BrandMark compact />
          <View style={styles.centeredPanel}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.helperText}>Checking camera access…</Text>
          </View>
        </View>
      </ProductShell>
    )
  }

  if (!permission.granted) {
    const wasDenied = permission.status === 'denied'

    return (
      <ProductShell activeTab="scan">
        <View style={styles.content}>
          <BrandMark compact />
          <View style={styles.permissionCard}>
            <View style={styles.cameraIcon}>
              <Text style={styles.cameraIconText}>⌗</Text>
            </View>
            <Text style={styles.eyebrow}>LOCAL QR SCANNER</Text>
            <Text style={styles.permissionTitle}>Scan a Stampd code</Text>
            <Text style={styles.permissionCopy}>
              {wasDenied
                ? 'Camera access is needed to scan Stampd loyalty codes.'
                : 'Stampd uses your camera only to read a loyalty QR code. Frames are not saved or uploaded.'}
            </Text>
            <View style={styles.permissionActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void requestPermission()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>{wasDenied ? 'Try Again' : 'Open Camera'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={goBack}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ProductShell>
    )
  }

  return (
    <ProductShell activeTab="scan">
      <View style={styles.content}>
        <BrandMark compact />

        <View style={styles.scannerHeader}>
          <Text style={styles.eyebrow}>SCAN A MERCHANT CODE</Text>
          <Text style={styles.scannerTitle}>Hold the QR inside the frame</Text>
          <Text style={styles.scannerCopy}>Scanned values are checked locally and are never opened as links.</Text>
        </View>

        <View style={styles.cameraFrame}>
          <CameraView
            active={isCameraActive}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            facing="back"
            onBarcodeScanned={isReady ? handleBarcodeScanned : undefined}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.scanGuide}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          {feedback !== 'idle' && (
            <View style={styles.feedbackOverlay}>
              {feedback === 'processing' && <ActivityIndicator color={colors.accent} />}
              <Text style={styles.feedbackText}>
                {feedback === 'invalid' && 'Invalid Stampd code'}
                {feedback === 'processing' && 'Saving stamp locally…'}
                {feedback === 'duplicate' && 'Stamp already collected'}
                {feedback === 'storage-error' && 'Stamp could not be saved. Please try again.'}
              </Text>
              {feedback === 'storage-error' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={resetScanner}
                  style={({ pressed }) => [styles.overlayButton, pressed && styles.pressed]}
                >
                  <Text style={styles.overlayButtonText}>Try Again</Text>
                </Pressable>
              )}
              {feedback === 'duplicate' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={goBack}
                  style={({ pressed }) => [styles.overlayButton, pressed && styles.pressed]}
                >
                  <Text style={styles.overlayButtonText}>Back to Passport</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <Text style={styles.privacyNote}>Camera only · No photos · No uploads</Text>
      </View>
    </ProductShell>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 },
  centeredPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 13 },
  helperText: { color: colors.textSoft, fontSize: 13, fontWeight: '600' },
  permissionCard: {
    flex: 1,
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cameraIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
  },
  cameraIconText: { color: colors.accent, fontSize: 32, lineHeight: 36, fontWeight: '800' },
  eyebrow: { marginTop: 24, color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  permissionTitle: {
    marginTop: 9,
    color: colors.text,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  permissionCopy: {
    maxWidth: 310,
    marginTop: 13,
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
  },
  permissionActions: { width: '100%', marginTop: 28, gap: 10 },
  primaryButton: {
    minHeight: 55,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentStrong,
  },
  primaryButtonText: { color: colors.accentInk, fontSize: 15, fontWeight: '900' },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.textSoft, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  scannerHeader: { marginTop: 22 },
  scannerTitle: {
    marginTop: 7,
    color: colors.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  scannerCopy: { marginTop: 7, color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  cameraFrame: {
    flex: 1,
    minHeight: 280,
    maxHeight: 430,
    marginTop: 19,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scanGuide: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 212,
    height: 212,
    marginTop: -106,
    marginLeft: -106,
  },
  corner: { position: 'absolute', width: 45, height: 45, borderColor: colors.accent, borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 14 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 14 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 14 },
  bottomRight: { right: 0, bottom: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 14 },
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: 'rgba(9, 17, 13, 0.91)',
  },
  feedbackText: { color: colors.text, fontSize: 18, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  overlayButton: {
    minHeight: 44,
    marginTop: 3,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentStrong,
  },
  overlayButtonText: { color: colors.accentInk, fontSize: 13, fontWeight: '900' },
  privacyNote: { marginTop: 12, color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
})
