import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

/**
 * Cached price fetcher
 * Caches Stripe price data for 1 hour to reduce API calls and improve performance
 */
const getCachedPrice = unstable_cache(
  async (priceId: string) => {
    const price = await stripe.prices.retrieve(priceId)
    return price
  },
  ['stripe-price'],
  {
    revalidate: 3600, // Cache for 1 hour (price changes are infrequent)
    tags: ['stripe-price'],
  }
)

/**
 * GET /api/get-price
 * Fetches the current price from Stripe Price ID (with 1-hour cache)
 * Returns formatted amount, currency, and price ID
 */
export async function GET() {
  try {
    // Fetch price from Stripe (cached for 1 hour)
    const price = await getCachedPrice(process.env.STRIPE_PRICE_ID!)

    // Validate price has required fields
    if (!price.unit_amount || !price.currency) {
      console.error('Invalid price object - missing unit_amount or currency:', price)
      return NextResponse.json(
        { error: 'Invalid pricing configuration' },
        { status: 500 }
      )
    }

    // Return formatted price information
    return NextResponse.json({
      amount: price.unit_amount,
      currency: price.currency,
      priceId: price.id,
      // Format for display (e.g., $24.95)
      formattedAmount: (price.unit_amount / 100).toFixed(2),
    })
  } catch (error) {
    console.error('Failed to fetch Stripe price:', error)
    return NextResponse.json(
      { error: 'Unable to fetch pricing information' },
      { status: 500 }
    )
  }
}
