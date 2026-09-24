export type Reward = {
  amount: number
  currency: 'SKR'
}

export type LoyaltyMerchant = {
  id: 'seeker-coffee' | 'pixel-cards'
  name: string
  category: string
  stamps: {
    current: number
    total: number
  }
  reward: Reward
}

export const mockUser = {
  greeting: 'Welcome to Stampd',
  passportName: 'Your Seeker Passport',
} as const

export const mockMerchants: LoyaltyMerchant[] = [
  {
    id: 'seeker-coffee',
    name: 'Seeker Coffee',
    category: 'Coffee & Community',
    stamps: {
      current: 4,
      total: 5,
    },
    reward: {
      amount: 20,
      currency: 'SKR',
    },
  },
  {
    id: 'pixel-cards',
    name: 'Pixel Cards',
    category: 'Collectibles',
    stamps: {
      current: 2,
      total: 5,
    },
    reward: {
      amount: 15,
      currency: 'SKR',
    },
  },
]

export const seekerCoffee = mockMerchants[0]
export const pixelCards = mockMerchants[1]

export function getSeekerCoffee(isDemoStampCollected: boolean): LoyaltyMerchant {
  return {
    ...seekerCoffee,
    stamps: {
      ...seekerCoffee.stamps,
      current: isDemoStampCollected ? 5 : 4,
    },
  }
}

export function getDemoPassportStats(isDemoStampCollected: boolean) {
  const merchants = [getSeekerCoffee(isDemoStampCollected), pixelCards]

  return {
    stamps: merchants.reduce((total, merchant) => total + merchant.stamps.current, 0),
    places: merchants.length,
    eligibilityReady: merchants.filter((merchant) => merchant.stamps.current >= merchant.stamps.total).length,
  }
}
