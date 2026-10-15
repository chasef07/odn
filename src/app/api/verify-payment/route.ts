import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { normalizeEmailForConversions } from '@/lib/conversion-tracking'

function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmailForConversions(email)).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent ID is required' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    const email = paymentIntent.metadata?.email || null

    return NextResponse.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency || null,
      email,
      emailSha256: email ? hashEmail(email) : null,
    })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json({ error: 'Invalid payment intent' }, { status: 400 })
  }
}
