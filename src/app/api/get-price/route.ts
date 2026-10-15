import { NextResponse } from 'next/server'
import { getCachedPrice } from '@/lib/stripe-price'

export async function GET() {
  try {
    const price = await getCachedPrice(process.env.STRIPE_PRICE_ID!)

    if (!price.unit_amount || !price.currency) {
      console.error('Invalid price object - missing unit_amount or currency:', price)
      return NextResponse.json({ error: 'Invalid pricing configuration' }, { status: 500 })
    }

    return NextResponse.json({
      amount: price.unit_amount,
      currency: price.currency,
      priceId: price.id,
      formattedAmount: (price.unit_amount / 100).toFixed(2),
    })
  } catch (error) {
    console.error('Failed to fetch Stripe price:', error)
    return NextResponse.json({ error: 'Unable to fetch pricing information' }, { status: 500 })
  }
}
