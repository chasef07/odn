import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { SubmissionStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { FormData } from '@/lib/form-storage'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'

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

    // 2. EARLY EXIT - Only process payment_intent.succeeded events (ignore all others)
    // This prevents abandoned checkouts, failed payments, and legacy events from causing errors
    if (event.type !== 'payment_intent.succeeded') {
      if (process.env.NODE_ENV === 'development') {
        console.log('Ignoring non-succeeded event:', {
          eventId: event.id,
          eventType: event.type,
        })
      }
      // Return 200 OK to acknowledge receipt and stop Stripe from retrying
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // 3. Smart age validation: Reject OLD events that were ALREADY PROCESSED
    // Allows legitimate old events (abandoned checkouts, webhook retries) to process
    const eventAge = Date.now() - (event.created * 1000)
    const MAX_EVENT_AGE = 10 * 60 * 1000 // 10 minutes in milliseconds

    if (eventAge > MAX_EVENT_AGE) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent

      // Check if this payment was already processed successfully
      const existingSubmission = await prisma.submission.findUnique({
        where: { stripePaymentIntentId: paymentIntent.id },
        select: { id: true }
      })

      if (existingSubmission) {
        // Already processed - safe to reject this duplicate/legacy retry
        console.warn('Rejecting stale event (already processed):', {
          eventId: event.id,
          paymentIntentId: paymentIntent.id,
          submissionId: existingSubmission.id,
          ageMinutes: Math.floor(eventAge / 60000),
        })
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // NOT processed yet - this is a legitimate old event:
      // - Abandoned checkout (user returned days later)
      // - Webhook retry after first attempt failed
      // Allow processing to continue
      console.warn('Allowing stale event (never processed):', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        ageMinutes: Math.floor(eventAge / 60000),
        reason: 'No Submission exists - likely abandoned checkout or failed first attempt',
      })
      // Don't return - fall through to processing logic below
    }

    // 4. Log event for debugging and audit trail (Stripe best practice)
    if (process.env.NODE_ENV === 'development') {
      console.log('Webhook event received:', {
        eventId: event.id,
        eventType: event.type,
        created: new Date(event.created * 1000).toISOString(),
      })
    }

    // 5. Handle payment_intent.succeeded event (we already filtered for this above)
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    if (process.env.NODE_ENV === 'development') {
      console.log('Processing payment_intent.succeeded:', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
      })
    }

    // 6. Check idempotency (prevent duplicate processing)
      const existingSubmission = await prisma.submission.findUnique({
        where: { stripePaymentIntentId: paymentIntent.id },
      })

      if (existingSubmission) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Submission already processed (idempotent):', {
            eventId: event.id,
            paymentIntentId: paymentIntent.id,
          })
        }
        return NextResponse.json({ received: true })
      }

      // 7. Retrieve form data from TemporarySubmission
      // Primary lookup by paymentIntentId
      let tempSubmission = await prisma.temporarySubmission.findUnique({
        where: { paymentIntentId: paymentIntent.id },
      })

      // 7a. Fallback: If not found by paymentIntentId, try metadata.temporarySubmissionId
      // This handles race conditions where webhook fires during the update step
      if (!tempSubmission && paymentIntent.metadata?.temporarySubmissionId) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Primary lookup failed, attempting fallback by metadata.temporarySubmissionId')
        }

        const tempSubmissionById = await prisma.temporarySubmission.findUnique({
          where: { id: paymentIntent.metadata.temporarySubmissionId },
        })

        if (tempSubmissionById) {
          if (process.env.NODE_ENV === 'development') {
            console.log('FALLBACK SUCCESS: Found TemporarySubmission by metadata ID')
          }

          // Update with correct payment intent ID to link them properly
          tempSubmission = await prisma.temporarySubmission.update({
            where: { id: tempSubmissionById.id },
            data: { paymentIntentId: paymentIntent.id },
          })

          if (process.env.NODE_ENV === 'development') {
            console.log('TemporarySubmission updated with correct paymentIntentId:', paymentIntent.id)
          }
        }
      }

      // 7b. If still not found after fallback, return 500 for Stripe to retry
      // This is a genuine error - no recovery submission created
      if (!tempSubmission) {
        console.error('TemporarySubmission not found for payment:', paymentIntent.id)
        console.error('CRITICAL: Payment succeeded but TemporarySubmission missing', {
          eventId: event.id,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          email: paymentIntent.metadata.email,
          attemptedFallback: !!paymentIntent.metadata?.temporarySubmissionId,
        })

        // Return 500 so Stripe retries - do NOT create recovery submission
        // Stripe will retry with exponential backoff, giving DB time to sync
        return NextResponse.json({ error: 'Temporary submission not found' }, { status: 500 })
      }

      const formData = tempSubmission.formData as FormData

      // 8. Validate form data before creating Submission
      if (!formData.email || !formData.patientFirstName) {
        console.error('Invalid form data in TemporarySubmission:', tempSubmission.id)
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
      }

      // 9. Create permanent Submission record
      let submission: Awaited<ReturnType<typeof prisma.submission.create>>
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
          console.log('Submission created successfully:', {
            eventId: event.id,
            submissionId: submission.id,
            paymentIntentId: paymentIntent.id,
          })
        }

        // 9a. Revalidate admin dashboard cache (immediate update)
        revalidatePath('/admin')
        revalidatePath('/admin/review')
        revalidatePath('/admin/approved')

        // 9b. Send payment confirmation email (NON-BLOCKING - fire and forget)
        // Remove await to return 200 OK to Stripe immediately
        sendPaymentConfirmationEmail({
          to: submission.email,
          patientName: submission.patientFirstName,
          submissionId: submission.id,
        }).then(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Payment confirmation email sent:', submission.email)
          }
        }).catch((emailError) => {
          // NON-BLOCKING: Log warning but don't fail webhook
          console.warn('Failed to send payment confirmation email (non-critical):', emailError)
        })
      } catch (submissionError) {
        console.error('Failed to create Submission:', submissionError)

        // CRITICAL: Payment succeeded but Submission creation failed
        // TemporarySubmission still exists, can be recovered
        console.error('CRITICAL: Submission creation failed', {
          eventId: event.id,
          paymentIntentId: paymentIntent.id,
          tempSubmissionId: tempSubmission.id,
        })

        // Return 500 so Stripe retries
        return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })
      }

    // 10. Delete TemporarySubmission (cleanup)
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

    // 11. Return success
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Unexpected webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
