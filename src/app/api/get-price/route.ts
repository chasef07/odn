import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

/**
 * GET /api/get-price
 * Fetches the current price from Stripe Price ID
 * Returns formatted amount, currency, and price ID
 */
export async function GET() {
  try {
    // Fetch price from Stripe
    const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID!)

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
