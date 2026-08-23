import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentPage from '@/app/payment/page'
import { I18nProvider } from '@/components/i18n/I18nProvider'

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/payment',
}))

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  PaymentElement: () => null,
  useElements: () => null,
  useStripe: () => null,
}))

vi.mock('@/components/form-layout', () => ({
  FormLayout: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/form-storage', () => ({
  getFormData: () => ({ email: 'patient@example.com', patientFirstName: 'Pat' }),
}))

describe('PaymentPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows the localized generic message when the payment request cannot connect', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(
      <I18nProvider>
        <PaymentPage />
      </I18nProvider>
    )

    expect(
      await screen.findByText('No se pudo conectar con el servicio de pago. Inténtelo de nuevo.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()
  })
})
