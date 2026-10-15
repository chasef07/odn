import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Prisma, SubmissionStatus } from '@prisma/client'
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
import { parseAttribution } from '@/lib/attribution'
import { revalidatePath } from 'next/cache'

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
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
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

    const existingSubmission = await prisma.submission.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
      select: { id: true },
    })

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

    let tempSubmission = await prisma.temporarySubmission.findUnique({
      where: { paymentIntentId: paymentIntent.id },
    })

    if (!tempSubmission && paymentIntent.metadata?.temporarySubmissionId) {
      logger.info('Primary lookup failed, attempting fallback by metadata.temporarySubmissionId')

      const tempSubmissionById = await prisma.temporarySubmission.findUnique({
        where: { id: paymentIntent.metadata.temporarySubmissionId },
      })

      if (tempSubmissionById) {
        logger.info('FALLBACK SUCCESS: Found TemporarySubmission by metadata ID')

        tempSubmission = await prisma.temporarySubmission.update({
          where: { id: tempSubmissionById.id },
          data: { paymentIntentId: paymentIntent.id },
        })

        logger.info('TemporarySubmission updated with correct paymentIntentId:', paymentIntent.id)
      }
    }

    if (!tempSubmission) {
      logger.error('TemporarySubmission not found for payment:', paymentIntent.id)
      logger.error('CRITICAL: Payment succeeded but TemporarySubmission missing', {
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        email: paymentIntent.metadata.email,
        attemptedFallback: !!paymentIntent.metadata?.temporarySubmissionId,
      })

      return NextResponse.json({ error: 'Temporary submission not found' }, { status: 500 })
    }

    const formData = tempSubmission.formData as FormData
    const attribution = parseAttribution(
      (tempSubmission.formData as { attribution?: unknown }).attribution
    )

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

    let submission: Awaited<ReturnType<typeof prisma.submission.create>>
    try {
      const smsOptedIn = formData.smsOptIn === true
      submission = await prisma.submission.create({
        data: {
          stripePaymentIntentId: paymentIntent.id,
          paymentAmount: paymentIntent.amount,
          offerCode: paymentIntent.metadata?.offer_code || null,
          offerPriceId: paymentIntent.metadata?.offer_price_id || null,
          attributionChannel: attribution?.last.channel ?? null,
          utmSource: attribution?.last.source ?? null,
          utmMedium: attribution?.last.medium ?? null,
          utmCampaign: attribution?.last.campaign ?? null,
          attribution: attribution ? (attribution as unknown as Prisma.InputJsonValue) : undefined,
          status: hasValidationFailure ? SubmissionStatus.MAYBE : SubmissionStatus.PENDING_REVIEW,
          denialReason: null,
          maybeReason: hasValidationFailure ? INTERNAL_ONLY_MAYBE_REASON : null,
          maybeInternalNote: hasValidationFailure
            ? `Auto-flagged: ${validationReasons.join('; ')}`
            : null,
          maybeEmailSentAt: null,

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
            ? (formData.symptoms as unknown as Prisma.InputJsonValue)
            : undefined,
          otherSymptomText: formData.otherSymptomText || null,
          additionalInformation: formData.additionalInformation || null,

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
      await prisma.temporarySubmission.delete({
        where: { id: tempSubmission.id },
      })
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
