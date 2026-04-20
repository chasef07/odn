import { unstable_cache } from 'next/cache'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

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
