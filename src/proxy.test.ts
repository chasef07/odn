import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'

describe('verification host routing', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redirects the verification host root to manual lookup', () => {
    const response = proxy(new NextRequest('https://phealthclinic.com/'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://phealthclinic.com/verify')
  })

  it('serves only verification routes on the verification host', () => {
    const allowed = proxy(new NextRequest('https://phealthclinic.com/verify/v_testslug'))
    const blockedPage = proxy(new NextRequest('https://phealthclinic.com/start'))
    const blockedApi = proxy(new NextRequest('https://phealthclinic.com/api/create-payment-intent'))

    expect(allowed.status).toBe(200)
    expect(allowed.headers.get('x-middleware-next')).toBe('1')
    expect(blockedPage.status).toBe(404)
    expect(blockedApi.status).toBe(404)
  })

  it('disallows crawling the dedicated verification host', async () => {
    const response = proxy(new NextRequest('https://phealthclinic.com/robots.txt'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    await expect(response.text()).resolves.toBe('User-agent: *\nDisallow: /\n')
  })

  it('permanently redirects legacy verification URLs and preserves the request', () => {
    vi.stubEnv('VERIFICATION_BASE_URL', 'https://phealthclinic.com')
    const response = proxy(
      new NextRequest('https://onlinedoctornote.com/verify/v_legacy?source=qr')
    )

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      'https://phealthclinic.com/verify/v_legacy?source=qr'
    )
  })

  it('preserves Spanish verification paths during the legacy redirect', () => {
    vi.stubEnv('VERIFICATION_BASE_URL', 'https://phealthclinic.com')
    const response = proxy(new NextRequest('https://www.onlinedoctornote.com/es/verify/v_legacy'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://phealthclinic.com/es/verify/v_legacy')
  })

  it('does not apply production host rules to previews or local development', () => {
    const response = proxy(
      new NextRequest('https://onlinedoctornote-git-feature.vercel.app/verify/v_test')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
