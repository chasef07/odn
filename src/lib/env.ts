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

  const priceId = process.env.STRIPE_PRICE_ID
  if (priceId && !priceId.startsWith('price_')) {
    throw new Error('STRIPE_PRICE_ID must start with "price_"')
  }

  const friendsFamilyPriceId = process.env.STRIPE_FRIENDS_FAMILY_PRICE_ID
  if (friendsFamilyPriceId && !friendsFamilyPriceId.startsWith('price_')) {
    throw new Error('STRIPE_FRIENDS_FAMILY_PRICE_ID must start with "price_"')
  }

  const doctor10PriceId = process.env.STRIPE_DOCTOR_10_PRICE_ID
  if (doctor10PriceId && !doctor10PriceId.startsWith('price_')) {
    throw new Error('STRIPE_DOCTOR_10_PRICE_ID must start with "price_"')
  }

  if (!process.env.RESEND_FROM_EMAIL && process.env.NODE_ENV === 'development') {
    console.warn('⚠️  RESEND_FROM_EMAIL not set, using default: noreply@onlinedoctornote.com')
  }

  if (process.env.NODE_ENV === 'development') {
    console.info('✅ Environment variables validated successfully')
  }
}

if (typeof window === 'undefined') {
  validateEnvironment()
}
