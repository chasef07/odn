/**
 * Environment Variable Validation
 * Validates required environment variables on startup
 * Fails fast if critical config is missing
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID',
  'CRON_SECRET',
  'BETTER_AUTH_SECRET',
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
] as const

export function validateEnvironment() {
  const missing: string[] = []

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}`
    )
  }

  // Validate STRIPE_PRICE_ID format
  const priceId = process.env.STRIPE_PRICE_ID
  if (priceId && !priceId.startsWith('price_')) {
    throw new Error('STRIPE_PRICE_ID must start with "price_"')
  }

  // Warn about optional but recommended variables
  if (!process.env.RESEND_FROM_EMAIL && process.env.NODE_ENV === 'development') {
    console.warn('⚠️  RESEND_FROM_EMAIL not set, using default: noreply@onlinedoctornote.com')
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Environment variables validated successfully')
  }
}

// Validate on module load (server-side only)
if (typeof window === 'undefined') {
  validateEnvironment();
}
