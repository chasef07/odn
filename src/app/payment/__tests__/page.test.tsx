import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentPage from '@/app/payment/page'
import { I18nProvider } from '@/components/i18n/I18nProvider'

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/payment',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({
    children,
    options,
  }: {
    children: React.ReactNode
    options: { clientSecret: string }
  }) => (
    <div data-testid="checkout" data-client-secret={options.clientSecret}>
      {children}
    </div>
  ),
  EmbeddedCheckout: () => null,
}))

vi.mock('@/components/form-layout', () => ({
  FormLayout: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/form-storage', () => ({
  getFormData: () => ({ email: 'patient@example.com', patientFirstName: 'Pat' }),
}))

describe('PaymentPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}')))
    )
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

  it('creates a Checkout Session in the page locale and embeds Checkout with its client secret', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ clientSecret: 'cs_test_secret' }), { status: 200 })
    )

    render(
      <I18nProvider>
        <PaymentPage />
      </I18nProvider>
    )

    expect(await screen.findByTestId('checkout')).toHaveAttribute(
      'data-client-secret',
      'cs_test_secret'
    )
    expect(fetch).toHaveBeenCalledWith('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData: { email: 'patient@example.com', patientFirstName: 'Pat' },
        locale: 'es',
      }),
    })
  })
})
