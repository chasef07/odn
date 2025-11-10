import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent ID is required' }, { status: 400 })
    }

    // Retrieve the payment intent from Stripe to verify its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    // Return the actual payment status from Stripe
    return NextResponse.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount,
    })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json({ error: 'Invalid payment intent' }, { status: 400 })
  }
}
