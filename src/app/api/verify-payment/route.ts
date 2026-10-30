import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { normalizeEmailForConversions } from '@/lib/conversion-tracking'

type CheckoutPaymentStatus = 'paid' | 'processing' | 'open' | 'expired'

function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmailForConversions(email)).digest('hex')
}

function paymentStatus(session: Stripe.Checkout.Session): CheckoutPaymentStatus {
  if (session.payment_status === 'paid') return 'paid'
  if (session.status === 'complete') return 'processing'
  if (session.status === 'expired') return 'expired'
  return 'open'
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Checkout Session ID is required' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const email = session.customer_email
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null)

    return NextResponse.json({
      status: paymentStatus(session),
      paymentIntentId,
      amount: session.amount_total,
      currency: session.currency,
      email,
      emailSha256: email ? hashEmail(email) : null,
    })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json({ error: 'Invalid Checkout Session' }, { status: 400 })
  }
}
