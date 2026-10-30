import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentSuccessPage from '@/app/payment/success/page'
import { I18nProvider } from '@/components/i18n/I18nProvider'

const { router, mockTrackPurchaseOnce, mockClearFormData } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() },
  mockTrackPurchaseOnce: vi.fn(),
  mockClearFormData: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/payment/success',
  useRouter: () => router,
}))

vi.mock('@/components/form-layout', () => ({
  FormLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

vi.mock('@/lib/conversion-tracking', () => ({
  trackPurchaseOnce: mockTrackPurchaseOnce,
}))

vi.mock('@/lib/form-storage', () => ({
  clearFormData: mockClearFormData,
  getFirstName: () => null,
}))

const verified = {
  paymentIntentId: 'pi_test_123',
  amount: 2995,
  currency: 'usd',
  email: 'patient@example.com',
  emailSha256: 'hash',
}

function respond(body: Record<string, unknown>) {
  vi.mocked(fetch).mockImplementation(async (url) =>
    url === '/api/verify-payment'
      ? new Response(JSON.stringify(body), { status: 200 })
      : new Response('{}')
  )
}

function renderPage() {
  render(
    <I18nProvider>
      <PaymentSuccessPage />
    </I18nProvider>
  )
}

describe('PaymentSuccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    window.history.replaceState(null, '', '/payment/success?session_id=cs_test_123')
  })

  it('confirms a paid session, records the purchase once and clears the draft', async () => {
    respond({ ...verified, status: 'paid' })

    renderPage()

    expect(await screen.findByText('Payment Successful')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'cs_test_123' }),
    })
    expect(mockTrackPurchaseOnce).toHaveBeenCalledWith({
      transactionId: 'pi_test_123',
      amountCents: 2995,
      currency: 'usd',
      emailSha256: 'hash',
    })
    expect(mockClearFormData).toHaveBeenCalledOnce()
  })

  it('tells a bank payer the payment is processing instead of showing an error', async () => {
    respond({ ...verified, status: 'processing' })

    renderPage()

    expect(await screen.findByText('Payment Received')).toBeInTheDocument()
    expect(screen.getByText(/Your bank payment is processing/)).toBeInTheDocument()
    expect(screen.queryByText('Payment verification failed')).not.toBeInTheDocument()
    expect(mockTrackPurchaseOnce).not.toHaveBeenCalled()
    expect(mockClearFormData).toHaveBeenCalledOnce()
  })

  it('sends a customer whose session is still open back to payment', async () => {
    respond({ ...verified, status: 'open', paymentIntentId: null })

    renderPage()

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/payment'))
    expect(mockTrackPurchaseOnce).not.toHaveBeenCalled()
    expect(mockClearFormData).not.toHaveBeenCalled()
  })

  it('shows the error for an expired session', async () => {
    respond({ ...verified, status: 'expired', paymentIntentId: null })

    renderPage()

    expect(await screen.findByText('Payment verification failed')).toBeInTheDocument()
    expect(mockClearFormData).not.toHaveBeenCalled()
  })

  it('shows the error without calling the server when the URL has no session id', async () => {
    window.history.replaceState(null, '', '/payment/success')

    renderPage()

    expect(await screen.findByText('Payment verification failed')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalledWith('/api/verify-payment', expect.anything())
  })
})
