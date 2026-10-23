import { env } from './src/lib/env'

const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unit-tests-have-no-database',
  NEXT_PUBLIC_SITE_URL: 'https://onlinedoctornote.com',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
  STRIPE_PRICE_ID: 'price_placeholder',
  CRON_SECRET: 'cron_placeholder',
  BETTER_AUTH_SECRET: 'better_auth_placeholder_secret_32_chars',
  BETTER_AUTH_URL: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google_client_secret_placeholder',
  ADMIN_EMAILS: 'doctor@example.test',
  RESEND_API_KEY: 're_placeholder',
  RESEND_WEBHOOK_SECRET: 'whsec_resend_placeholder',
  RESEND_FROM_EMAIL: 'noreply@onlinedoctornote.com',
  DOCTOR_NAME: 'Jason Buchwald',
  DOCTOR_CREDENTIALS: 'MD FACEP',
  DOCTOR_SIGNATURE_URL: '/images/doctor-signature.png',
  VERIFICATION_BASE_URL: 'https://phealthclinic.com',
  TELNYX_SMS_ENABLED: 'false',
}

function isTestControlled(name: string): boolean {
  return (
    Object.hasOwn(env, name) ||
    name.startsWith('NEXT_PUBLIC_') ||
    name.startsWith('PG') ||
    name === 'NODE_ENV'
  )
}

export function resetTestEnv(): void {
  for (const name of Object.keys(process.env)) {
    if (isTestControlled(name)) delete process.env[name]
  }
  Object.assign(process.env, TEST_ENV)
}
