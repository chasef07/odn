import { afterEach, describe, expect, it, vi } from 'vitest'
import { env, googleAdsAccount, serverEnvProblems, telnyxSmsSender } from '@/lib/env'
import { publicEnv } from '@/lib/public-env'

describe('server env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads the current value on every access', () => {
    vi.stubEnv('STRIPE_PRICE_ID', 'price_first')
    expect(env.STRIPE_PRICE_ID).toBe('price_first')

    vi.stubEnv('STRIPE_PRICE_ID', 'price_second')
    expect(env.STRIPE_PRICE_ID).toBe('price_second')
  })

  it('names a missing required var', () => {
    vi.stubEnv('RESEND_FROM_EMAIL', '')

    expect(() => env.RESEND_FROM_EMAIL).toThrow('Environment variable RESEND_FROM_EMAIL is not set')
  })

  it('rejects a malformed value', () => {
    vi.stubEnv('STRIPE_PRICE_ID', 'prod_123')

    expect(() => env.STRIPE_PRICE_ID).toThrow(
      'Environment variable STRIPE_PRICE_ID is invalid: must start with "price_"'
    )
  })

  it('treats an empty optional var as unset', () => {
    vi.stubEnv('STRIPE_FRIENDS_FAMILY_PRICE_ID', '')
    vi.stubEnv('TELNYX_WEBHOOK_ENABLED', '')

    expect(env.STRIPE_FRIENDS_FAMILY_PRICE_ID).toBeUndefined()
    expect(env.TELNYX_WEBHOOK_ENABLED).toBe(true)
  })

  it('parses the Telnyx webhook switch to a boolean', () => {
    vi.stubEnv('TELNYX_WEBHOOK_ENABLED', 'false')

    expect(env.TELNYX_WEBHOOK_ENABLED).toBe(false)
  })

  it('leaves intake validation in log-only mode until INTAKE_VALIDATION_ENFORCED is true', () => {
    vi.stubEnv('INTAKE_VALIDATION_ENFORCED', '')
    expect(env.INTAKE_VALIDATION_ENFORCED).toBe(false)

    vi.stubEnv('INTAKE_VALIDATION_ENFORCED', 'true')
    expect(env.INTAKE_VALIDATION_ENFORCED).toBe(true)

    vi.stubEnv('INTAKE_VALIDATION_ENFORCED', 'shadow')
    expect(() => env.INTAKE_VALIDATION_ENFORCED).toThrow(
      'Environment variable INTAKE_VALIDATION_ENFORCED is invalid'
    )
  })

  it('reads ADMIN_EMAILS as a trimmed, lower-case list of emails', () => {
    vi.stubEnv('ADMIN_EMAILS', ' Doctor@Example.test, second@example.test ,')

    expect(env.ADMIN_EMAILS).toEqual(['doctor@example.test', 'second@example.test'])
  })

  it('rejects an ADMIN_EMAILS that names no email or a malformed one', () => {
    vi.stubEnv('ADMIN_EMAILS', ' , ')
    expect(() => env.ADMIN_EMAILS).toThrow(
      'Environment variable ADMIN_EMAILS is invalid: must name at least one email'
    )

    vi.stubEnv('ADMIN_EMAILS', 'doctor@example.test,not-an-email')
    expect(() => env.ADMIN_EMAILS).toThrow('Environment variable ADMIN_EMAILS is invalid')
  })

  it('turns SMS off only when TELNYX_SMS_ENABLED is false', () => {
    vi.stubEnv('TELNYX_SMS_ENABLED', 'false')
    expect(telnyxSmsSender()).toBeNull()

    vi.stubEnv('TELNYX_SMS_ENABLED', '')
    expect(() => telnyxSmsSender()).toThrow('Environment variable TELNYX_SMS_ENABLED is not set')
  })

  it('reports an unset SMS switch once at startup', () => {
    vi.stubEnv('TELNYX_SMS_ENABLED', '')

    expect(serverEnvProblems()).toEqual(['Environment variable TELNYX_SMS_ENABLED is not set'])
  })

  it('fails loudly when SMS is on without its credentials', () => {
    vi.stubEnv('TELNYX_SMS_ENABLED', 'true')
    vi.stubEnv('TELNYX_API_KEY', 'KEY123')
    vi.stubEnv('TELNYX_FROM_NUMBER', '')

    expect(() => telnyxSmsSender()).toThrow(
      'TELNYX_SMS_ENABLED is true, so TELNYX_API_KEY and TELNYX_FROM_NUMBER must be set'
    )
    expect(serverEnvProblems()).toEqual([
      'TELNYX_SMS_ENABLED is true, so TELNYX_API_KEY and TELNYX_FROM_NUMBER must be set',
    ])

    vi.stubEnv('TELNYX_FROM_NUMBER', '+15555550100')
    expect(telnyxSmsSender()).toEqual({ apiKey: 'KEY123', from: '+15555550100' })
  })

  it('turns the Google Ads tool off until both Google Ads vars are set', () => {
    expect(googleAdsAccount()).toBeNull()

    vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '7678754198')
    vi.stubEnv('GOOGLE_ADS_QUOTA_PROJECT', 'acuity-ads-api')
    expect(googleAdsAccount()).toEqual({
      customerId: '7678754198',
      quotaProject: 'acuity-ads-api',
    })
  })

  it('fails loudly at startup when only one Google Ads var is set or the customer id is malformed', () => {
    vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '7678754198')

    expect(() => googleAdsAccount()).toThrow(
      'GOOGLE_ADS_CUSTOMER_ID and GOOGLE_ADS_QUOTA_PROJECT must be set together'
    )
    expect(serverEnvProblems()).toEqual([
      'GOOGLE_ADS_CUSTOMER_ID and GOOGLE_ADS_QUOTA_PROJECT must be set together',
    ])

    vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '767-875-4198')
    expect(() => env.GOOGLE_ADS_CUSTOMER_ID).toThrow(
      'Environment variable GOOGLE_ADS_CUSTOMER_ID is invalid'
    )
  })

  it('reports every missing var at startup', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('DOCTOR_NAME', '')

    expect(serverEnvProblems()).toEqual([
      'Environment variable CRON_SECRET is not set',
      'Environment variable DOCTOR_NAME is not set',
    ])
  })

  it('passes at startup when every required var is set', () => {
    expect(serverEnvProblems()).toEqual([])
  })
})

describe('public env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the site URL without a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://onlinedoctornote.com/')

    expect(publicEnv.NEXT_PUBLIC_SITE_URL).toBe('https://onlinedoctornote.com')
  })

  it('names a missing public var', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', '')

    expect(() => publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toThrow(
      'Environment variable NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set'
    )
  })
})
