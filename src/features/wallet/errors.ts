type WalletErrorLike = {
  code?: unknown
}

export function getWalletErrorMessage(error: unknown): string {
  const code = getErrorCode(error)

  switch (code) {
    case 'ERROR_WALLET_NOT_FOUND':
      return 'No compatible Solana wallet found.'
    case 'ERROR_ASSOCIATION_CANCELLED':
    case 'ERROR_SESSION_CLOSED':
      return 'Wallet connection cancelled.'
    case 'ERROR_SESSION_TIMEOUT':
      return 'The wallet request timed out. Please try again.'
    case -1:
      return 'Wallet authorization was not approved.'
    default:
      return 'Unable to connect to a Solana wallet. Please try again.'
  }
}

function getErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }

  return (error as WalletErrorLike).code
}
