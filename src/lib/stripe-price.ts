import { unstable_cache } from 'next/cache'
import { stripe } from '@/lib/stripe'

export const getCachedPrice = unstable_cache(
  async (priceId: string) => {
    return await stripe.prices.retrieve(priceId)
  },
  ['stripe-price'],
  {
    revalidate: 3600,
    tags: ['stripe-price'],
  }
)
