export const OFFER_QUERY_PARAM = 'offer'
export const FRIENDS_FAMILY_OFFER_CODE = 'friends20'
export const DOCTOR_10_OFFER_CODE = 'doctor10'

export type PriceType = 'standard' | 'friends_family' | 'doctor_10'

export type OfferConfig = {
  code: string
  missingConfigError: string
  missingConfigLog: string
  priceEnvVar: string
  priceType: Exclude<PriceType, 'standard'>
}

export const OFFER_CONFIGS = [
  {
    code: FRIENDS_FAMILY_OFFER_CODE,
    missingConfigError: 'Friends and family offer is not configured. Please contact support.',
    missingConfigLog:
      'Friends and family offer requested but STRIPE_FRIENDS_FAMILY_PRICE_ID is unset',
    priceEnvVar: 'STRIPE_FRIENDS_FAMILY_PRICE_ID',
    priceType: 'friends_family',
  },
  {
    code: DOCTOR_10_OFFER_CODE,
    missingConfigError: 'Doctor offer is not configured. Please contact support.',
    missingConfigLog: 'Doctor offer requested but STRIPE_DOCTOR_10_PRICE_ID is unset',
    priceEnvVar: 'STRIPE_DOCTOR_10_PRICE_ID',
    priceType: 'doctor_10',
  },
] as const satisfies readonly OfferConfig[]

export function normalizeOfferCode(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }

  const normalized = input.trim().toLowerCase()
  if (!normalized || normalized.length > 64) {
    return null
  }

  return /^[a-z0-9_-]+$/.test(normalized) ? normalized : null
}

export function getOfferConfig(input: unknown): OfferConfig | null {
  const normalized = normalizeOfferCode(input)
  return OFFER_CONFIGS.find((offer) => offer.code === normalized) ?? null
}
