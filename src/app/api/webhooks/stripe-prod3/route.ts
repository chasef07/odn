import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { SubmissionStatus, type JsonValue } from '@/db/types'
import { findSubmissionIdForPaymentIntent, insertSubmission } from '@/db/submissions'
import { deleteTemporarySubmission, findTemporarySubmissionById } from '@/db/temporary-submissions'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import { purchaseConfirmationSms, SMS_CONSENT_VERSION } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import { toE164UsPhone } from '@/lib/phone-utils'
import { loggedIssues, parseIntake } from '@/lib/intake'
import { INTERNAL_ONLY_MAYBE_REASON } from '@/lib/maybe-reasons'
import { parseAttribution } from '@/lib/attribution'
import { revalidatePath } from 'next/cache'

const ENDPOINT = '/api/webhooks/stripe-prod3'

export async function POST(request: NextRequest) {
  let event: Stripe.Event

  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      logger.error('Missing Stripe signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)
    } catch (signatureError) {
      logger.error('Webhook signature verification failed:', signatureError)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    if (event.type !== 'payment_intent.succeeded') {
      logger.info('Ignoring non-succeeded event:', {
        eventId: event.id,
        eventType: event.type,
      })
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent

    const existingSubmission = await findSubmissionIdForPaymentIntent(paymentIntent.id)

    const eventAge = Date.now() - event.created * 1000
    const MAX_EVENT_AGE = 10 * 60 * 1000

    if (eventAge > MAX_EVENT_AGE) {
      if (existingSubmission) {
        logger.warn('Rejecting stale event (already processed):', {
          eventId: event.id,
          paymentIntentId: paymentIntent.id,
          submissionId: existingSubmission.id,
          ageMinutes: Math.floor(eventAge / 60000),
        })
        return NextResponse.json({ received: true }, { status: 200 })
      }

      logger.warn('Allowing stale event (never processed):', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        ageMinutes: Math.floor(eventAge / 60000),
        reason: 'No Submission exists - likely abandoned checkout or failed first attempt',
      })
    }

    if (existingSubmission) {
      logger.info('Submission already processed (idempotent):', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        submissionId: existingSubmission.id,
      })
      return NextResponse.json({ received: true })
    }

    logger.info('Webhook event received:', {
      eventId: event.id,
      eventType: event.type,
      paymentIntentId: paymentIntent.id,
      created: new Date(event.created * 1000).toISOString(),
    })

    const tempSubmissionId = paymentIntent.metadata?.temporarySubmissionId
    const tempSubmission = tempSubmissionId
      ? await findTemporarySubmissionById(tempSubmissionId)
      : null

    if (!tempSubmission) {
      logger.error('TemporarySubmission not found for payment:', paymentIntent.id)
      logger.error('CRITICAL: Payment succeeded but TemporarySubmission missing', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        email: paymentIntent.metadata.email,
        tempSubmissionId: tempSubmissionId ?? null,
      })

      return NextResponse.json({ error: 'Temporary submission not found' }, { status: 500 })
    }

    const attribution = parseAttribution(
      (tempSubmission.formData as { attribution?: unknown }).attribution
    )

    const intake = parseIntake(tempSubmission.formData)

    if (intake.kind === 'shape_failure') {
      logger.event('ERROR', {
        event: 'intake_shape_failure',
        endpoint: ENDPOINT,
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        tempSubmissionId: tempSubmission.id,
        issues: loggedIssues(intake.issues),
      })

      return NextResponse.json(
        { error: 'Paid submission requires manual recovery' },
        { status: 500 }
      )
    }

    const flagged = intake.kind === 'rule_failure'
    const reasons = flagged ? intake.issues.map((issue) => `${issue.field}: ${issue.message}`) : []

    if (flagged) {
      logger.event('ERROR', {
        event: 'intake_rule_failure',
        endpoint: ENDPOINT,
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        tempSubmissionId: tempSubmission.id,
        issues: loggedIssues(intake.issues),
      })
    }

    const data = intake.data

    try {
      const { submission, inserted } = await insertSubmission({
        stripePaymentIntentId: paymentIntent.id,
        paymentAmount: paymentIntent.amount,
        offerCode: paymentIntent.metadata?.offer_code || null,
        offerPriceId: paymentIntent.metadata?.offer_price_id || null,
        attributionChannel: attribution?.last.channel ?? null,
        utmSource: attribution?.last.source ?? null,
        utmMedium: attribution?.last.medium ?? null,
        utmCampaign: attribution?.last.campaign ?? null,
        attribution: attribution ? (attribution as unknown as JsonValue) : undefined,
        status: flagged ? SubmissionStatus.MAYBE : SubmissionStatus.PENDING_REVIEW,
        denialReason: null,
        maybeReason: flagged ? INTERNAL_ONLY_MAYBE_REASON : null,
        maybeInternalNote: flagged ? `Auto-flagged: ${reasons.join('; ')}` : null,
        maybeEmailSentAt: null,

        state: data.state,
        recipient: data.recipient,
        patientFirstName: data.patientFirstName,
        patientLastName: data.patientLastName,
        guardianFirstName: data.guardianFirstName,
        guardianLastName: data.guardianLastName,
        email: data.email,
        phone: data.phone,
        smsOptIn: data.smsOptIn,
        smsOptInAt: data.smsOptIn ? new Date() : null,
        smsConsentVersion: data.smsOptIn ? SMS_CONSENT_VERSION : null,
        smsPhoneE164: data.smsOptIn ? toE164UsPhone(data.phone) : null,
        notePurpose: data.notePurpose,
        otherNotePurpose: data.otherNotePurpose,
        absenceReason: data.absenceReason,
        otherAbsenceReason: data.otherAbsenceReason,
        symptoms: data.symptoms ?? undefined,
        otherSymptomText: data.otherSymptomText,
        additionalInformation: data.additionalInformation,
        patientDateOfBirth: data.patientDateOfBirth,
        guardianDateOfBirth: data.guardianDateOfBirth,
        firstDayOff: data.firstDayOff,
        lastDayOff: data.lastDayOff,
      })

      if (!inserted) {
        logger.info('Submission already processed by a concurrent delivery (idempotent):', {
          eventId: event.id,
          paymentIntentId: paymentIntent.id,
          submissionId: submission.id,
        })
        return NextResponse.json({ received: true })
      }

      logger.info('Submission created successfully:', {
        eventId: event.id,
        submissionId: submission.id,
        paymentIntentId: paymentIntent.id,
      })

      revalidatePath('/admin')
      revalidatePath('/admin/review')
      revalidatePath('/admin/approved')
      revalidatePath('/admin/maybe')

      try {
        await sendPaymentConfirmationEmail({
          to: submission.email,
          patientName: submission.patientFirstName,
          submissionId: submission.id,
        })
        logger.info('Payment confirmation email sent for submission:', submission.id)
      } catch (emailError) {
        logger.warn('Failed to send payment confirmation email (non-critical):', {
          submissionId: submission.id,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        })
      }

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

      logger.error('CRITICAL: Submission creation failed', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        tempSubmissionId: tempSubmission.id,
      })

      return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })
    }

    try {
      await deleteTemporarySubmission(tempSubmission.id)
      logger.info('TemporarySubmission deleted:', tempSubmission.id)
    } catch (deleteError) {
      logger.warn('Failed to delete TemporarySubmission (non-critical):', deleteError)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Unexpected webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
