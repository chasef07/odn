import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { FormData } from '@/lib/form-storage'
import { parseIntake } from '@/lib/intake'
import { getCachedPrice } from '@/lib/stripe-price'
import { getOfferConfig, normalizeOfferCode, type PriceType } from '@/lib/offer-codes'
import {
  ATTRIBUTION_COOKIE,
  attributionStripeMetadata,
  parseAttributionCookie,
} from '@/lib/attribution'

async function cancelPaymentIntentWithRetry(
  paymentIntentId: string,
  maxRetries = 3
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await stripe.paymentIntents.cancel(paymentIntentId)
      logger.info(`Payment intent canceled successfully on attempt ${i + 1}:`, paymentIntentId)
      return true
    } catch (error) {
      logger.error(`Failed to cancel payment intent (attempt ${i + 1}/${maxRetries}):`, error)

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, i)))
      }
    }
  }

  logger.error('CRITICAL: Failed to cancel payment intent after all retries', {
    paymentIntentId,
  })
  return false
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { formData, offerCode } = body as { formData?: unknown; offerCode?: unknown }

    if (!formData) {
      return NextResponse.json({ error: 'Form data is required' }, { status: 400 })
    }

    const intake = parseIntake(formData)
    if (intake.kind === 'shape_failure') {
      logger.warn('Intake rejected before payment: data cannot be persisted', {
        issues: intake.issues,
      })
      return NextResponse.json(
        { error: intake.issues[0].message, route: intake.issues[0].route },
        { status: 400 }
      )
    }
    if (intake.kind === 'rule_failure') {
      const enforced = env.INTAKE_VALIDATION_ENFORCED
      logger.warn('Intake failed validation rules', { enforced, issues: intake.issues })
      if (enforced) {
        return NextResponse.json(
          { error: intake.issues[0].message, route: intake.issues[0].route },
          { status: 400 }
        )
      }
    }

    const draft = formData as FormData
    const normalizedOfferCode = normalizeOfferCode(offerCode ?? draft.offerCode)
    const offerConfig = getOfferConfig(normalizedOfferCode)
    const offerPriceId = offerConfig ? env[offerConfig.priceEnvVar] : undefined

    if (offerConfig && !offerPriceId) {
      logger.error(offerConfig.missingConfigLog)
      return NextResponse.json({ error: offerConfig.missingConfigError }, { status: 500 })
    }

    const attribution = parseAttributionCookie(request.cookies.get(ATTRIBUTION_COOKIE)?.value)
    const { attribution: _clientAttribution, ...cleanFormData } = draft as FormData & {
      attribution?: unknown
    }
    const storedFormData = attribution ? { ...cleanFormData, attribution } : cleanFormData

    const offerApplied = Boolean(offerConfig)
    const selectedPriceId = offerPriceId ?? env.STRIPE_PRICE_ID
    const priceType: PriceType = offerConfig?.priceType ?? 'standard'

    let price: Stripe.Price
    try {
      price = await getCachedPrice(selectedPriceId)
    } catch (priceError) {
      logger.error('Failed to fetch Stripe price:', priceError)
      return NextResponse.json(
        { error: 'Unable to fetch pricing information. Please try again.' },
        { status: 500 }
      )
    }

    if (!price.unit_amount || !price.currency) {
      logger.error('Invalid price object - missing unit_amount or currency:', price)
      return NextResponse.json(
        { error: 'Invalid pricing configuration. Please contact support.' },
        { status: 500 }
      )
    }

    let tempSubmissionId: string
    try {
      const tempSubmission = await prisma.temporarySubmission.create({
        data: {
          paymentIntentId: `pending_${Date.now()}`,
          formData: storedFormData as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        },
      })
      tempSubmissionId = tempSubmission.id

      logger.info('TemporarySubmission created:', tempSubmissionId)
    } catch (dbError) {
      logger.error('Database error creating TemporarySubmission:', dbError)
      return NextResponse.json(
        { error: 'Unable to process your request. Please try again.' },
        { status: 500 }
      )
    }

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
          email: intake.data.email,
          price_id: price.id,
          price_type: priceType,
          offer_code: offerConfig?.code ?? '',
          offer_price_id: offerApplied ? price.id : '',
          temporarySubmissionId: tempSubmissionId,
          ...attributionStripeMetadata(attribution),
        },
      })

      logger.info('PaymentIntent created:', paymentIntent.id)
    } catch (stripeError) {
      logger.error('Stripe API error:', stripeError)

      try {
        await prisma.temporarySubmission.delete({
          where: { id: tempSubmissionId },
        })
        logger.info('Cleaned up TemporarySubmission after Stripe error:', tempSubmissionId)
      } catch (cleanupError) {
        logger.error('Failed to cleanup TemporarySubmission:', cleanupError)
      }

      return NextResponse.json(
        { error: 'Payment processing error. Please try again.' },
        { status: 500 }
      )
    }

    try {
      await prisma.temporarySubmission.update({
        where: { id: tempSubmissionId },
        data: {
          paymentIntentId: paymentIntent.id,
        },
      })

      logger.info('TemporarySubmission updated with PaymentIntent ID:', paymentIntent.id)
    } catch (updateError) {
      logger.error('Failed to update TemporarySubmission with payment intent ID:', updateError)

      logger.error('CRITICAL: Payment intent created but update failed', {
        paymentIntentId: paymentIntent.id,
        tempSubmissionId: tempSubmissionId,
        email: intake.data.email,
      })

      const cancelSucceeded = await cancelPaymentIntentWithRetry(paymentIntent.id)

      try {
        await prisma.temporarySubmission.delete({
          where: { id: tempSubmissionId },
        })
        logger.info('Cleaned up TemporarySubmission after update failure:', tempSubmissionId)
      } catch (cleanupError) {
        logger.error('Failed to cleanup TemporarySubmission after update failure:', cleanupError)
      }

      if (!cancelSucceeded) {
        logger.error(
          'CRITICAL: PaymentIntent may still be active, webhook can use metadata fallback'
        )
      }

      return NextResponse.json(
        { error: 'Unable to process your request. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: price.unit_amount,
      currency: price.currency,
      priceId: price.id,
      formattedAmount: (price.unit_amount / 100).toFixed(2),
      offerApplied,
      offerCode: offerConfig?.code ?? null,
    })
  } catch (error) {
    logger.error('Unexpected error in create-payment-intent:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
