import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export async function POST(request: NextRequest) {
  try {
    const paymentAmount = parseInt(process.env.NEXT_PUBLIC_PAYMENT_AMOUNT || '2999');

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      description: 'Doctor\'s Note - Online Medical Documentation',
      metadata: {
        product: 'doctors_note',
        service: 'online_medical_note',
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: paymentAmount,
    });
  } catch (error) {
    // Only log in development to avoid exposing sensitive error details in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Error creating payment intent:', error);
    }
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}
