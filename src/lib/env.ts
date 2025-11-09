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
  'NEXT_PUBLIC_PAYMENT_AMOUNT',
  'CRON_SECRET',
  'AUTH_SECRET',
  'RESEND_API_KEY',
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

  // Validate payment amount is a number
  const amount = Number(process.env.NEXT_PUBLIC_PAYMENT_AMOUNT)
  if (isNaN(amount) || amount <= 0) {
    throw new Error('NEXT_PUBLIC_PAYMENT_AMOUNT must be a positive number')
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
