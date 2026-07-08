import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { SubmissionStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { FormData } from '@/lib/form-storage'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import { purchaseConfirmationSms, SMS_CONSENT_VERSION } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import { toE164UsPhone } from '@/lib/phone-utils'
import { validatePaidSubmissionData } from '@/lib/paid-submission-validation'
import { INTERNAL_ONLY_MAYBE_REASON } from '@/lib/maybe-reasons'
import { revalidatePath } from 'next/cache'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

export async function POST(request: NextRequest) {
  let event: Stripe.Event

  try {
    // 1. Verify webhook signature
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      logger.error('Missing Stripe signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (signatureError) {
      logger.error('Webhook signature verification failed:', signatureError)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // 2. EARLY EXIT - Only process payment_intent.succeeded events (ignore all others)
    // This prevents abandoned checkouts, failed payments, and legacy events from causing errors
    if (event.type !== 'payment_intent.succeeded') {
      logger.info('Ignoring non-succeeded event:', {
        eventId: event.id,
        eventType: event.type,
      })
      // Return 200 OK to acknowledge receipt and stop Stripe from retrying
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // 3. Extract payment intent for reuse
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    // 4. Check idempotency + age validation (single DB query for both)
    // This query serves two purposes:
    // - Prevents duplicate processing (idempotency)
    // - Enables smart age validation for old events
    const existingSubmission = await prisma.submission.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
      select: { id: true },
    })

    // 5. Smart age validation: Reject OLD events that were ALREADY PROCESSED
    // Allows legitimate old events (abandoned checkouts, webhook retries) to process
    const eventAge = Date.now() - event.created * 1000
    const MAX_EVENT_AGE = 10 * 60 * 1000 // 10 minutes in milliseconds

    if (eventAge > MAX_EVENT_AGE) {
      if (existingSubmission) {
        // Already processed - safe to reject this duplicate/legacy retry
        logger.warn('Rejecting stale event (already processed):', {
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
      logger.warn('Allowing stale event (never processed):', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        ageMinutes: Math.floor(eventAge / 60000),
        reason: 'No Submission exists - likely abandoned checkout or failed first attempt',
      })
      // Don't return - fall through to processing logic below
    }

    // 6. Idempotency check for recent events (reuse existingSubmission from above)
    if (existingSubmission) {
      logger.info('Submission already processed (idempotent):', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        submissionId: existingSubmission.id,
      })
      return NextResponse.json({ received: true })
    }

    // 7. Log event for debugging and audit trail (Stripe best practice)
    logger.info('Webhook event received:', {
      eventId: event.id,
      eventType: event.type,
      paymentIntentId: paymentIntent.id,
      created: new Date(event.created * 1000).toISOString(),
    })

    // 7. Retrieve form data from TemporarySubmission
    // Primary lookup by paymentIntentId
    let tempSubmission = await prisma.temporarySubmission.findUnique({
      where: { paymentIntentId: paymentIntent.id },
    })

    // 7a. Fallback: If not found by paymentIntentId, try metadata.temporarySubmissionId
    // This handles race conditions where webhook fires during the update step
    if (!tempSubmission && paymentIntent.metadata?.temporarySubmissionId) {
      logger.info('Primary lookup failed, attempting fallback by metadata.temporarySubmissionId')

      const tempSubmissionById = await prisma.temporarySubmission.findUnique({
        where: { id: paymentIntent.metadata.temporarySubmissionId },
      })

      if (tempSubmissionById) {
        logger.info('FALLBACK SUCCESS: Found TemporarySubmission by metadata ID')

        // Update with correct payment intent ID to link them properly
        tempSubmission = await prisma.temporarySubmission.update({
          where: { id: tempSubmissionById.id },
          data: { paymentIntentId: paymentIntent.id },
        })

        logger.info('TemporarySubmission updated with correct paymentIntentId:', paymentIntent.id)
      }
    }

    // 7b. If still not found after fallback, return 500 for Stripe to retry
    // This is a genuine error - no recovery submission created
    if (!tempSubmission) {
      logger.error('TemporarySubmission not found for payment:', paymentIntent.id)
      logger.error('CRITICAL: Payment succeeded but TemporarySubmission missing', {
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

    // 8. Re-validate paid submission data server-side. This is the last gate
    // before we write a permanent record: even if the payment-intent API was
    // bypassed (e.g., an old unpaid TemporarySubmission with stale data was
    // paired with a successful PaymentIntent), we refuse to create an
    // auto-processable record with invalid data.
    //
    // Decision:
    // - If the payload is complete enough to persist, we still create the
    //   Submission but force status=MAYBE so a doctor reviews it manually.
    // - If required persisted fields are missing or unparseable, we fail the
    //   webhook so Stripe retries and the TemporarySubmission is retained for
    //   manual recovery instead of silently orphaning the paid record.
    const validation = validatePaidSubmissionData(formData)
    const validationReasons = validation.errors
    const hasValidationFailure = validationReasons.length > 0

    if (!validation.canPersistSubmission) {
      logger.error('PAID SUBMISSION CANNOT BE PERSISTED - leaving webhook retryable', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        tempSubmissionId: tempSubmission.id,
        email: formData.email,
        patientFirstName: formData.patientFirstName,
        patientLastName: formData.patientLastName,
        reasons: validationReasons,
      })

      return NextResponse.json(
        { error: 'Paid submission requires manual recovery' },
        { status: 500 }
      )
    }

    if (hasValidationFailure) {
      logger.error('PAID SUBMISSION FAILED SERVER-SIDE VALIDATION - routing to MAYBE queue', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        tempSubmissionId: tempSubmission.id,
        email: formData.email,
        patientFirstName: formData.patientFirstName,
        patientLastName: formData.patientLastName,
        reasons: validationReasons,
      })
    }

    // 9. Create permanent Submission record
    let submission: Awaited<ReturnType<typeof prisma.submission.create>>
    try {
      const smsOptedIn = formData.smsOptIn === true
      submission = await prisma.submission.create({
        data: {
          // System fields
          stripePaymentIntentId: paymentIntent.id,
          paymentAmount: paymentIntent.amount,
          offerCode: paymentIntent.metadata?.offer_code || null,
          offerPriceId: paymentIntent.metadata?.offer_price_id || null,
          status: hasValidationFailure ? SubmissionStatus.MAYBE : SubmissionStatus.PENDING_REVIEW,
          denialReason: null,
          maybeReason: hasValidationFailure ? INTERNAL_ONLY_MAYBE_REASON : null,
          maybeInternalNote: hasValidationFailure
            ? `Auto-flagged: ${validationReasons.join('; ')}`
            : null,
          maybeEmailSentAt: null,

          // Direct copy fields
          state: formData.state!,
          recipient: formData.recipient!,
          patientFirstName: formData.patientFirstName!,
          patientLastName: formData.patientLastName!,
          guardianFirstName: formData.guardianFirstName || null,
          guardianLastName: formData.guardianLastName || null,
          email: formData.email!,
          phone: formData.phone!,
          smsOptIn: smsOptedIn,
          smsOptInAt: smsOptedIn ? new Date() : null,
          smsConsentVersion: smsOptedIn ? SMS_CONSENT_VERSION : null,
          smsPhoneE164: smsOptedIn ? toE164UsPhone(formData.phone) : null,
          notePurpose: formData.notePurpose!,
          otherNotePurpose: formData.otherNotePurpose || null,
          absenceReason: formData.absenceReason!,
          otherAbsenceReason: formData.otherAbsenceReason || null,
          symptoms: formData.symptoms
            ? (formData.symptoms as unknown as Record<string, unknown>)
            : undefined,
          otherSymptomText: formData.otherSymptomText || null,
          additionalInformation: formData.additionalInformation || null,

          // Date conversions are validated before we write the permanent record.
          patientDateOfBirth: validation.parsedDates.patientDateOfBirth!,
          guardianDateOfBirth: validation.parsedDates.guardianDateOfBirth,
          firstDayOff: validation.parsedDates.firstDayOff!,
          lastDayOff: validation.parsedDates.lastDayOff!,
        },
      })

      logger.info('Submission created successfully:', {
        eventId: event.id,
        submissionId: submission.id,
        paymentIntentId: paymentIntent.id,
      })

      // 9a. Revalidate admin dashboard cache (immediate update)
      revalidatePath('/admin')
      revalidatePath('/admin/review')
      revalidatePath('/admin/approved')
      revalidatePath('/admin/maybe')

      // 9b. Send payment confirmation email (NON-BLOCKING - fire and forget)
      // Remove await to return 200 OK to Stripe immediately
      sendPaymentConfirmationEmail({
        to: submission.email,
        patientName: submission.patientFirstName,
        submissionId: submission.id,
      })
        .then(() => {
          logger.info('Payment confirmation email sent:', submission.email)
        })
        .catch((emailError) => {
          // NON-BLOCKING: Log warning but don't fail webhook
          logger.warn('Failed to send payment confirmation email (non-critical):', emailError)
        })

      if (submission.smsOptIn) {
        sendTransactionalSmsForSubmission({
          submission,
          type: 'PURCHASE_CONFIRMATION',
          body: purchaseConfirmationSms(submission.id),
        }).catch((smsError) => {
          logger.warn('Failed to send transactional SMS (non-critical):', {
            submissionId: submission.id,
            type: 'PURCHASE_CONFIRMATION',
            error: smsError instanceof Error ? smsError.message : 'Unknown SMS error',
          })
        })
      }
    } catch (submissionError) {
      logger.error('Failed to create Submission:', submissionError)

      // CRITICAL: Payment succeeded but Submission creation failed
      // TemporarySubmission still exists, can be recovered
      logger.error('CRITICAL: Submission creation failed', {
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
      logger.info('TemporarySubmission deleted:', tempSubmission.id)
    } catch (deleteError) {
      // Non-critical - Submission was created successfully
      // TemporarySubmission will be cleaned up by scheduled job
      logger.warn('Failed to delete TemporarySubmission (non-critical):', deleteError)
    }

    // 11. Return success
    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Unexpected webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
