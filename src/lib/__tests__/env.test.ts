import { afterEach, describe, expect, it, vi } from 'vitest'
import { env, serverEnvProblems } from '@/lib/env'
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
