import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createTemporarySubmission, deleteTemporarySubmission } from '@/db/temporary-submissions'
import type { JsonValue } from '@/db/types'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { FormData } from '@/lib/form-storage'
import { checkoutBlockers, loggedIssues, parseIntake } from '@/lib/intake'
import { termsSchema } from '@/lib/validation-schemas'
import { getOfferConfig, normalizeOfferCode, type PriceType } from '@/lib/offer-codes'
import { localizePath, type Locale } from '@/lib/i18n'
import {
  ATTRIBUTION_COOKIE,
  attributionStripeMetadata,
  parseAttributionCookie,
} from '@/lib/attribution'

const ENDPOINT = '/api/create-checkout-session'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { formData, offerCode } = body as { formData?: unknown; offerCode?: unknown }
    const locale: Locale = body.locale === 'es' ? 'es' : 'en'

    if (!formData) {
      return NextResponse.json({ error: 'Form data is required' }, { status: 400 })
    }

    const origin = request.headers.get('origin')
    if (!origin) {
      return NextResponse.json({ error: 'Origin header is required' }, { status: 400 })
    }

    const intake = parseIntake(formData)
    if (intake.kind === 'shape_failure') {
      logger.event('WARNING', {
        event: 'intake_shape_failure',
        endpoint: ENDPOINT,
        issues: loggedIssues(intake.issues),
      })
      return NextResponse.json(
        { error: intake.issues[0].message, route: intake.issues[0].route },
        { status: 400 }
      )
    }
    if (intake.kind === 'rule_failure') {
      const enforced = env.INTAKE_VALIDATION_ENFORCED
      const blocking = checkoutBlockers(intake.issues, enforced)
      logger.event('WARNING', {
        event: 'intake_rule_failure',
        endpoint: ENDPOINT,
        enforced,
        blocked: blocking.length > 0,
        issues: loggedIssues(intake.issues),
      })
      if (blocking.length > 0) {
        return NextResponse.json(
          { error: blocking[0].message, route: blocking[0].route },
          { status: 400 }
        )
      }
    }

    const consent = termsSchema.safeParse(formData)
    if (!consent.success) {
      logger.event('WARNING', {
        event: 'checkout_consent_missing',
        endpoint: ENDPOINT,
        fields: consent.error.issues.map((issue) => issue.path.join('.')),
      })
      return NextResponse.json(
        { error: consent.error.issues[0].message, route: '/review' },
        { status: 400 }
      )
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

    const selectedPriceId = offerPriceId ?? env.STRIPE_PRICE_ID
    const priceType: PriceType = offerConfig?.priceType ?? 'standard'

    let tempSubmissionId: string
    try {
      const tempSubmission = await createTemporarySubmission({
        formData: storedFormData as unknown as JsonValue,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
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

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        mode: 'payment',
        line_items: [{ price: selectedPriceId, quantity: 1 }],
        customer_email: intake.data.email,
        locale,
        return_url: `${origin}${localizePath('/payment/success?session_id={CHECKOUT_SESSION_ID}', locale)}`,
        payment_intent_data: {
          description: "Doctor's Note - Online Medical Documentation",
          metadata: {
            product: 'doctors-note',
            service: 'online-doctors-note',
            email: intake.data.email,
            price_id: selectedPriceId,
            price_type: priceType,
            offer_code: offerConfig?.code ?? '',
            offer_price_id: offerConfig ? selectedPriceId : '',
            temporarySubmissionId: tempSubmissionId,
            ...attributionStripeMetadata(attribution),
          },
        },
      })

      logger.info('Checkout Session created:', session.id)
    } catch (stripeError) {
      logger.error('Stripe API error:', stripeError)

      try {
        await deleteTemporarySubmission(tempSubmissionId)
        logger.info('Cleaned up TemporarySubmission after Stripe error:', tempSubmissionId)
      } catch (cleanupError) {
        logger.error('Failed to cleanup TemporarySubmission:', cleanupError)
      }

      return NextResponse.json(
        { error: 'Payment processing error. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (error) {
    logger.error('Unexpected error in create-checkout-session:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
