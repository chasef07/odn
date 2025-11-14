import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { FormData } from '@/lib/form-storage'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

/**
 * Attempts to cancel a Stripe payment intent with retries and exponential backoff
 * @param stripe Stripe instance
 * @param paymentIntentId Payment intent ID to cancel
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @returns true if cancellation succeeded, false otherwise
 */
async function cancelPaymentIntentWithRetry(
  stripe: Stripe,
  paymentIntentId: string,
  maxRetries = 3
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await stripe.paymentIntents.cancel(paymentIntentId)
      if (process.env.NODE_ENV === 'development') {
        console.log(`Payment intent canceled successfully on attempt ${i + 1}:`, paymentIntentId)
      }
      return true
    } catch (error) {
      console.error(`Failed to cancel payment intent (attempt ${i + 1}/${maxRetries}):`, error)

      if (i < maxRetries - 1) {
        // Wait before retry with exponential backoff: 100ms, 200ms, 400ms
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, i)))
      }
    }
  }

  // All retries failed
  console.error('CRITICAL: Failed to cancel payment intent after all retries', {
    paymentIntentId,
  })
  return false
}

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

    // 5. Create TemporarySubmission FIRST with placeholder payment intent ID
    // This ensures the database record exists before the PaymentIntent is created,
    // preventing race conditions where webhooks fire before DB writes complete
    let tempSubmissionId: string
    try {
      const tempSubmission = await prisma.temporarySubmission.create({
        data: {
          paymentIntentId: `pending_${Date.now()}`, // Temporary placeholder
          formData: formData as unknown as Record<string, unknown>,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      })
      tempSubmissionId = tempSubmission.id

      if (process.env.NODE_ENV === 'development') {
        console.log('TemporarySubmission created:', tempSubmissionId)
      }
    } catch (dbError) {
      console.error('Database error creating TemporarySubmission:', dbError)
      return NextResponse.json(
        { error: 'Unable to process your request. Please try again.' },
        { status: 500 }
      )
    }

    // 6. Create Stripe payment intent SECOND with reference to temp submission
    // The metadata.temporarySubmissionId provides a fallback lookup path for webhooks
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
          temporarySubmissionId: tempSubmissionId, // Add reference for webhook fallback
        },
      })

      if (process.env.NODE_ENV === 'development') {
        console.log('PaymentIntent created:', paymentIntent.id)
      }
    } catch (stripeError) {
      console.error('Stripe API error:', stripeError)

      // Cleanup: Delete the temporary submission we just created
      try {
        await prisma.temporarySubmission.delete({
          where: { id: tempSubmissionId },
        })
        if (process.env.NODE_ENV === 'development') {
          console.log('Cleaned up TemporarySubmission after Stripe error:', tempSubmissionId)
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup TemporarySubmission:', cleanupError)
      }

      return NextResponse.json(
        { error: 'Payment processing error. Please try again.' },
        { status: 500 }
      )
    }

    // 7. Update TemporarySubmission with real payment intent ID
    // This links the database record to the actual Stripe payment
    try {
      await prisma.temporarySubmission.update({
        where: { id: tempSubmissionId },
        data: {
          paymentIntentId: paymentIntent.id,
        },
      })

      if (process.env.NODE_ENV === 'development') {
        console.log('TemporarySubmission updated with PaymentIntent ID:', paymentIntent.id)
      }
    } catch (updateError) {
      console.error('Failed to update TemporarySubmission with payment intent ID:', updateError)

      // CRITICAL: We have a payment intent AND a temp submission, but they're not linked
      console.error('CRITICAL: Payment intent created but update failed', {
        paymentIntentId: paymentIntent.id,
        tempSubmissionId: tempSubmissionId,
        email: formData.email,
      })

      // Try to cancel payment intent with retry logic
      const cancelSucceeded = await cancelPaymentIntentWithRetry(stripe, paymentIntent.id)

      // Try to delete temp submission
      try {
        await prisma.temporarySubmission.delete({
          where: { id: tempSubmissionId },
        })
        if (process.env.NODE_ENV === 'development') {
          console.log('Cleaned up TemporarySubmission after update failure:', tempSubmissionId)
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup TemporarySubmission after update failure:', cleanupError)
      }

      if (!cancelSucceeded) {
        // Payment intent exists but couldn't be canceled - webhook might still process it
        // The metadata.temporarySubmissionId will allow webhook to find the temp submission
        console.error('CRITICAL: PaymentIntent may still be active, webhook can use metadata fallback')
      }

      return NextResponse.json(
        { error: 'Unable to process your request. Please try again.' },
        { status: 500 }
      )
    }

    // 8. Success - return client secret
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
