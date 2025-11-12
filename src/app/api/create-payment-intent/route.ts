import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { FormData } from '@/lib/form-storage'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body = await request.json()
    const { formData } = body as { formData: FormData }

    if (!formData) {
      return NextResponse.json({ error: 'Form data is required' }, { status: 400 })
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
    ]

    const missingFields = requiredFields.filter((field) => !formData[field as keyof FormData])

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
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
        )
      }
    }

    // 4. Fetch price from Stripe
    let price: Stripe.Price
    try {
      price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID!)
    } catch (priceError) {
      console.error('Failed to fetch Stripe price:', priceError)
      return NextResponse.json(
        { error: 'Unable to fetch pricing information. Please try again.' },
        { status: 500 }
      )
    }

    // Validate price has required fields
    if (!price.unit_amount || !price.currency) {
      console.error('Invalid price object - missing unit_amount or currency:', price)
      return NextResponse.json(
        { error: 'Invalid pricing configuration. Please contact support.' },
        { status: 500 }
      )
    }

    // 5. Create Stripe payment intent with dynamic price
    let paymentIntent: Stripe.PaymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: price.unit_amount,
        currency: price.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        description: "Doctor's Note - Online Medical Documentation",
        metadata: {
          product: 'doctors-note',
          service: 'online-doctors-note',
          email: formData.email || '',
          price_id: price.id,
        },
      })
    } catch (stripeError) {
      console.error('Stripe API error:', stripeError)
      return NextResponse.json(
        { error: 'Payment processing error. Please try again.' },
        { status: 500 }
      )
    }

    // 6. Create TemporarySubmission with form data
    try {
      await prisma.temporarySubmission.create({
        data: {
          paymentIntentId: paymentIntent.id,
          formData: formData as unknown as Record<string, unknown>, // Prisma Json type
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      })
    } catch (dbError) {
      console.error('Database error creating TemporarySubmission:', dbError)

      // CRITICAL: Payment intent created but DB failed
      // Log this for manual recovery
      console.error('CRITICAL: Payment intent created but TemporarySubmission failed', {
        paymentIntentId: paymentIntent.id,
        email: formData.email,
      })

      // Cancel the payment intent to prevent charging user
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id)
        if (process.env.NODE_ENV === 'development') {
          console.log('Payment intent canceled successfully:', paymentIntent.id)
        }
      } catch (cancelError) {
        console.error('Failed to cancel payment intent:', cancelError)
      }

      return NextResponse.json(
        { error: 'Unable to process your request. Please try again.' },
        { status: 500 }
      )
    }

    // 7. Success - return client secret
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error) {
    console.error('Unexpected error in create-payment-intent:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
