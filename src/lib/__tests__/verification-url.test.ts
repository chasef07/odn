import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getVerificationBaseUrl,
  getVerificationUrl,
  isVerificationHostname,
  isVerificationPath,
} from '@/lib/verification-url'

describe('verification URL contract', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the dedicated verification origin', () => {
    vi.stubEnv('VERIFICATION_BASE_URL', 'https://phealthclinic.com/')

    expect(getVerificationBaseUrl()).toBe('https://phealthclinic.com')
    expect(getVerificationUrl('v_testslug')).toBe('https://phealthclinic.com/verify/v_testslug')
  })

  it('defaults production verification links to P Health Clinic', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERIFICATION_BASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://onlinedoctornote.com')

    expect(getVerificationBaseUrl()).toBe('https://phealthclinic.com')
  })

  it('keeps local verification links local outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERIFICATION_BASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000/')

    expect(getVerificationBaseUrl()).toBe('http://localhost:3000')
  })

  it('rejects a configured base URL with a path', () => {
    vi.stubEnv('VERIFICATION_BASE_URL', 'https://phealthclinic.com/verify')

    expect(() => getVerificationBaseUrl()).toThrow(
      'VERIFICATION_BASE_URL must be an HTTP(S) origin without a path'
    )
  })

  it('recognizes verification hosts and routes exactly', () => {
    expect(isVerificationHostname('phealthclinic.com')).toBe(true)
    expect(isVerificationHostname('www.phealthclinic.com')).toBe(true)
    expect(isVerificationHostname('phealthclinic.com:443')).toBe(true)
    expect(isVerificationHostname('onlinedoctornote.com')).toBe(false)

    expect(isVerificationPath('/verify')).toBe(true)
    expect(isVerificationPath('/verify/v_test')).toBe(true)
    expect(isVerificationPath('/es/verify/v_test')).toBe(true)
    expect(isVerificationPath('/verification')).toBe(false)
    expect(isVerificationPath('/admin')).toBe(false)
  })
})
