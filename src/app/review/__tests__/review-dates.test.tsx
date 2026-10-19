import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import ReviewPage from '../page'

const { pathname } = vi.hoisted(() => ({ pathname: { current: '/review' } }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

function renderWithDraft(draft: Record<string, unknown>) {
  vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(draft))
  return render(
    <I18nProvider>
      <ReviewPage />
    </I18nProvider>
  )
}

const draft = {
  recipient: 'myself',
  patientFirstName: 'Jane',
  patientLastName: 'Doe',
  patientDateOfBirth: '1990-11-01',
  email: 'jane@example.com',
  phone: '5551234567',
  firstDayOff: '2026-11-01',
  lastDayOff: '2026-11-03',
}

describe('review page dates', () => {
  beforeEach(() => {
    pathname.current = '/review'
  })

  it('shows each saved day as that calendar day', () => {
    renderWithDraft(draft)

    expect(screen.getByText(/November 1, 1990/)).toBeInTheDocument()
    expect(screen.getByText('November 1, 2026 - November 3, 2026')).toBeInTheDocument()
  })

  it('shows Spanish dates on the Spanish flow', () => {
    pathname.current = '/es/review'
    renderWithDraft(draft)

    expect(screen.getByText('1 de noviembre de 2026 - 3 de noviembre de 2026')).toBeInTheDocument()
  })

  it('shows an impossible saved day as entered instead of the next real day', () => {
    renderWithDraft({ ...draft, firstDayOff: '2027-02-29', lastDayOff: '2027-02-29' })

    expect(screen.queryByText(/March 1, 2027/)).not.toBeInTheDocument()
    expect(screen.getByText('2027-02-29 - 2027-02-29')).toBeInTheDocument()
  })
})
