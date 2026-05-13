export const OFFER_QUERY_PARAM = 'offer'
export const FRIENDS_FAMILY_OFFER_CODE = 'friends20'

export type PriceType = 'standard' | 'friends_family'

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

export function isFriendsFamilyOfferCode(input: unknown): boolean {
  return normalizeOfferCode(input) === FRIENDS_FAMILY_OFFER_CODE
}
