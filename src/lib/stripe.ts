import Stripe from 'stripe'

/**
 * Shared Stripe client. Import this instead of instantiating `new Stripe(...)`
 * so the secret key and API version stay consistent across the app.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})
