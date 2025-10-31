import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { FormData } from '@/lib/form-storage';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

const PAYMENT_AMOUNT = Number(process.env.NEXT_PUBLIC_PAYMENT_AMOUNT || 2495);

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body = await request.json();
    const { formData } = body as { formData: FormData };

    if (!formData) {
      return NextResponse.json(
        { error: 'Form data is required' },
        { status: 400 }
      );
    }

    // 2. Validate required fields
    const requiredFields = [
      'state',
      'recipient',
      'patientFirstName',
      'patientLastName',
      'patientDateOfBirth',
      'email',
      'phone',
      'notePurpose',
      'firstDayOff',
      'lastDayOff',
      'absenceReason',
    ];

    const missingFields = requiredFields.filter(
      (field) => !formData[field as keyof FormData]
    );

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // 3. Validate conditional fields
    if (formData.recipient === 'someone_else') {
      if (
        !formData.guardianFirstName ||
        !formData.guardianLastName ||
        !formData.guardianDateOfBirth
      ) {
        return NextResponse.json(
          { error: 'Guardian information is required when submitting for someone else' },
          { status: 400 }
        );
      }
    }

    // 4. Create Stripe payment intent FIRST
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: PAYMENT_AMOUNT,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        description: "Doctor's Note - Online Medical Documentation",
        metadata: {
          product: 'doctors-note',
          service: 'online-doctors-note',
          email: formData.email || '',
        },
      });
    } catch (stripeError) {
      console.error('Stripe API error:', stripeError);
      return NextResponse.json(
        { error: 'Payment processing error. Please try again.' },
        { status: 500 }
      );
    }

    // 5. Create TemporarySubmission with form data
    try {
      await prisma.temporarySubmission.create({
        data: {
          paymentIntentId: paymentIntent.id,
          formData: formData as unknown as Record<string, unknown>, // Prisma Json type
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });
    } catch (dbError) {
      console.error('Database error creating TemporarySubmission:', dbError);

      // CRITICAL: Payment intent created but DB failed
      // Log this for manual recovery
      console.error('CRITICAL: Payment intent created but TemporarySubmission failed', {
        paymentIntentId: paymentIntent.id,
        email: formData.email,
      });

      // Cancel the payment intent to prevent charging user
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
        console.log('Payment intent canceled successfully:', paymentIntent.id);
      } catch (cancelError) {
        console.error('Failed to cancel payment intent:', cancelError);
      }

      return NextResponse.json(
        { error: 'Unable to process your request. Please try again.' },
        { status: 500 }
      );
    }

    // 6. Success - return client secret
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Unexpected error in create-payment-intent:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
