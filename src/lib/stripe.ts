import Stripe from 'stripe'
import { env } from '@/lib/env'

let stripeClient: Stripe | null = null

function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  })
  return stripeClient
}

export const stripe = {
  get paymentIntents(): Stripe['paymentIntents'] {
    return getStripeClient().paymentIntents
  },
  get prices(): Stripe['prices'] {
    return getStripeClient().prices
  },
  get refunds(): Stripe['refunds'] {
    return getStripeClient().refunds
  },
  get webhooks(): Stripe['webhooks'] {
    return getStripeClient().webhooks
  },
}
