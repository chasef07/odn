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

  console.log('✅ Environment variables validated successfully')
}

// Validate on module load (server-side only)
// TEMPORARILY DISABLED for local testing - uncomment after adding real STRIPE_WEBHOOK_SECRET
// if (typeof window === 'undefined') {
//   validateEnvironment();
// }
