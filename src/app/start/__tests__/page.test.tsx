import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import StartPage from '@/app/start/page'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { FUNNEL_VISITOR_KEY } from '@/components/useFunnelStep'

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/start',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const visitorId = '6f1c2a8e-4b7d-4c3a-9e2f-1a2b3c4d5e6f'

describe('StartPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    ;(localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === FUNNEL_VISITOR_KEY ? visitorId : null
    )
  })

  it('reports the /start funnel step in its locale', () => {
    render(
      <I18nProvider>
        <StartPage />
      </I18nProvider>
    )

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse((fetch as Mock).mock.calls[0][1].body)).toEqual({
      visitorId,
      step: '/start',
      locale: 'es',
    })
  })
})
