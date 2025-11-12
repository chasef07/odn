import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { SubmissionStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { FormData } from '@/lib/form-storage'
import { sendPaymentConfirmationEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

export async function POST(request: NextRequest) {
  let event: Stripe.Event

  try {
    // 1. Verify webhook signature
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      console.error('Missing Stripe signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (signatureError) {
      console.error('Webhook signature verification failed:', signatureError)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // 2. Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      if (process.env.NODE_ENV === 'development') {
        console.log('Processing payment_intent.succeeded:', paymentIntent.id)
      }

      // 3. Check idempotency (prevent duplicate processing)
      const existingSubmission = await prisma.submission.findUnique({
        where: { stripePaymentIntentId: paymentIntent.id },
      })

      if (existingSubmission) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Submission already processed (idempotent):', paymentIntent.id)
        }
        return NextResponse.json({ received: true })
      }

      // 4. Retrieve form data from TemporarySubmission
      const tempSubmission = await prisma.temporarySubmission.findUnique({
        where: { paymentIntentId: paymentIntent.id },
      })

      if (!tempSubmission) {
        console.error('TemporarySubmission not found for payment:', paymentIntent.id)

        // CRITICAL: Payment succeeded but no form data
        // This should trigger an alert/manual review
        console.error('CRITICAL: Payment succeeded but TemporarySubmission missing', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          email: paymentIntent.metadata.email,
        })

        // Return 500 so Stripe retries (maybe race condition)
        return NextResponse.json({ error: 'Temporary submission not found' }, { status: 500 })
      }

      const formData = tempSubmission.formData as FormData

      // 5. Validate form data before creating Submission
      if (!formData.email || !formData.patientFirstName) {
        console.error('Invalid form data in TemporarySubmission:', tempSubmission.id)
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
      }

      // 6. Create permanent Submission record
      let submission
      try {
        submission = await prisma.submission.create({
          data: {
            // System fields
            stripePaymentIntentId: paymentIntent.id,
            status: SubmissionStatus.PENDING_REVIEW,

            // Direct copy fields
            state: formData.state!,
            recipient: formData.recipient!,
            patientFirstName: formData.patientFirstName!,
            patientLastName: formData.patientLastName!,
            guardianFirstName: formData.guardianFirstName || null,
            guardianLastName: formData.guardianLastName || null,
            email: formData.email!,
            phone: formData.phone!,
            notePurpose: formData.notePurpose!,
            otherNotePurpose: formData.otherNotePurpose || null,
            absenceReason: formData.absenceReason!,
            otherAbsenceReason: formData.otherAbsenceReason || null,
            symptoms: formData.symptoms
              ? (formData.symptoms as unknown as Record<string, unknown>)
              : undefined,
            otherSymptomText: formData.otherSymptomText || null,
            additionalInformation: formData.additionalInformation || null,

            // Date conversions with error handling
            patientDateOfBirth: new Date(formData.patientDateOfBirth!),
            guardianDateOfBirth: formData.guardianDateOfBirth
              ? new Date(formData.guardianDateOfBirth)
              : null,
            firstDayOff: new Date(formData.firstDayOff!),
            lastDayOff: new Date(formData.lastDayOff!),
          },
        })

        if (process.env.NODE_ENV === 'development') {
          console.log('Submission created successfully:', paymentIntent.id)
        }

        // 6a. Send payment confirmation email (NON-BLOCKING)
        try {
          await sendPaymentConfirmationEmail({
            to: submission.email,
            patientName: submission.patientFirstName,
            submissionId: submission.id,
          })

          if (process.env.NODE_ENV === 'development') {
            console.log('Payment confirmation email sent:', submission.email)
          }
        } catch (emailError) {
          // NON-BLOCKING: Log warning but don't fail webhook
          console.warn('Failed to send payment confirmation email (non-critical):', emailError)
        }
      } catch (submissionError) {
        console.error('Failed to create Submission:', submissionError)

        // CRITICAL: Payment succeeded but Submission creation failed
        // TemporarySubmission still exists, can be recovered
        console.error('CRITICAL: Submission creation failed', {
          paymentIntentId: paymentIntent.id,
          tempSubmissionId: tempSubmission.id,
        })

        // Return 500 so Stripe retries
        return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })
      }

      // 7. Delete TemporarySubmission (cleanup)
      try {
        await prisma.temporarySubmission.delete({
          where: { id: tempSubmission.id },
        })
        if (process.env.NODE_ENV === 'development') {
          console.log('TemporarySubmission deleted:', tempSubmission.id)
        }
      } catch (deleteError) {
        // Non-critical - Submission was created successfully
        // TemporarySubmission will be cleaned up by scheduled job
        console.warn('Failed to delete TemporarySubmission (non-critical):', deleteError)
      }
    }

    // 8. Return success
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Unexpected webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
