import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ATTRIBUTION_COOKIE, serializeAttributionCookie, touchFromVisit } from '@/lib/attribution'
import { FUNNEL_STEPS } from '@/lib/funnel'

const { mockRecordFunnelStep } = vi.hoisted(() => ({ mockRecordFunnelStep: vi.fn() }))

vi.mock('@/db/funnel-steps', () => ({ recordFunnelStep: mockRecordFunnelStep }))

import { POST } from '../route'

const visitorId = '6f1c2a8e-4b7d-4c3a-9e2f-1a2b3c4d5e6f'

function request(body: unknown, cookie?: string): NextRequest {
  return new NextRequest('https://onlinedoctornote.com/api/funnel-step', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: cookie ? { cookie } : {},
  })
}

function attributionCookie(landingUrl: string): string {
  const touch = touchFromVisit(new URL(landingUrl), null, new Date('2026-10-29T12:00:00.000Z'))
  return `${ATTRIBUTION_COOKIE}=${serializeAttributionCookie({ first: touch, last: touch })}`
}

describe('POST /api/funnel-step', () => {
  beforeEach(() => {
    mockRecordFunnelStep.mockResolvedValue(undefined)
  })

  it('records the step with the last-touch channel from the attribution cookie', async () => {
    const response = await POST(
      request(
        { visitorId, step: '/basic-info', locale: 'es' },
        attributionCookie('https://onlinedoctornote.com/?gclid=abc')
      )
    )

    expect(response.status).toBe(204)
    expect(mockRecordFunnelStep).toHaveBeenCalledWith({
      visitorId,
      step: '/basic-info',
      stepOrder: FUNNEL_STEPS.indexOf('/basic-info') + 1,
      locale: 'es',
      attributionChannel: 'google_ads',
    })
  })

  it('records a null channel without an attribution cookie', async () => {
    const response = await POST(request({ visitorId, step: '/payment', locale: 'en' }))

    expect(response.status).toBe(204)
    expect(mockRecordFunnelStep).toHaveBeenCalledWith(
      expect.objectContaining({ step: '/payment', attributionChannel: null })
    )
  })

  it('records a null channel when the cookie does not parse', async () => {
    await POST(request({ visitorId, step: '/review', locale: 'en' }, `${ATTRIBUTION_COOKIE}=junk`))

    expect(mockRecordFunnelStep).toHaveBeenCalledWith(
      expect.objectContaining({ attributionChannel: null })
    )
  })

  it('refuses an unknown step without recording it', async () => {
    const response = await POST(request({ visitorId, step: '/admin', locale: 'en' }))

    expect(response.status).toBe(400)
    expect(mockRecordFunnelStep).not.toHaveBeenCalled()
  })

  it('refuses a body that is not JSON without recording it', async () => {
    const response = await POST(request('not json'))

    expect(response.status).toBe(400)
    expect(mockRecordFunnelStep).not.toHaveBeenCalled()
  })

  it('answers 500 when the insert fails', async () => {
    mockRecordFunnelStep.mockRejectedValue(new Error('db down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(request({ visitorId, step: '/review', locale: 'en' }))

    expect(response.status).toBe(500)
    expect(error).toHaveBeenCalled()
  })
})
