import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { render } from '@testing-library/react'
import AttributionCapture from '@/components/AttributionCapture'
import { FUNNEL_VISIT_KEY, FUNNEL_VISITOR_KEY } from '@/components/useFunnelStep'
import { ATTRIBUTION_COOKIE } from '@/lib/attribution'

const visitorId = '6f1c2a8e-4b7d-4c3a-9e2f-1a2b3c4d5e6f'

function sentViews(): { step: string; locale: string }[] {
  return (fetch as Mock).mock.calls.map(([, init]) => JSON.parse(init.body))
}

function visit(path: string) {
  window.history.replaceState(null, '', path)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  ;(localStorage.getItem as Mock).mockImplementation((key: string) =>
    key === FUNNEL_VISITOR_KEY ? visitorId : null
  )
  sessionStorage.clear()
  document.cookie = `${ATTRIBUTION_COOKIE}=; Max-Age=0; Path=/`
  visit('/blog/sick-note')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AttributionCapture funnel visit', () => {
  it('reports one visit per browser session, on whatever page it lands', () => {
    render(<AttributionCapture />)
    render(<AttributionCapture />)

    expect(sentViews()).toEqual([{ visitorId, step: 'visit', locale: 'en' }])
    expect(sessionStorage.getItem(FUNNEL_VISIT_KEY)).not.toBeNull()
  })

  it('reports a new visit in a new session, in the locale of the page', () => {
    render(<AttributionCapture />)
    sessionStorage.clear()
    visit('/es/faq')
    render(<AttributionCapture />)

    expect(sentViews().map((view) => view.locale)).toEqual(['en', 'es'])
  })

  it('has written the channel cookie by the time the visit is sent', () => {
    let cookieWhenSent = ''
    ;(fetch as Mock).mockImplementation(() => {
      cookieWhenSent = document.cookie
      return Promise.resolve(new Response(null, { status: 204 }))
    })
    visit('/?gclid=abc')

    render(<AttributionCapture />)

    expect(cookieWhenSent).toContain(`${ATTRIBUTION_COOKIE}=`)
    expect(decodeURIComponent(cookieWhenSent)).toContain('"channel":"google_ads"')
  })

  it.each([
    '/payment/success',
    '/es/payment/success',
    '/approved',
    '/es/approved',
    '/admin',
    '/admin/agent',
  ])('does not count a visit that lands on %s', (path) => {
    visit(path)
    render(<AttributionCapture />)

    expect(fetch).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(FUNNEL_VISIT_KEY)).toBeNull()
  })

  it('sends nothing when session storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<AttributionCapture />)

    expect(fetch).not.toHaveBeenCalled()
  })
})
