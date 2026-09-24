export function resolveWalletControlProductEnabled(
  isDevelopmentBuild: boolean,
  internalIdentityPreviewFlag: string | undefined,
): boolean {
  return isDevelopmentBuild || internalIdentityPreviewFlag === 'true'
}

export const WALLET_CONTROL_PRODUCT_ENABLED = resolveWalletControlProductEnabled(
  typeof __DEV__ !== 'undefined' && __DEV__,
  process.env.EXPO_PUBLIC_INTERNAL_IDENTITY_PREVIEW_ENABLED,
)
