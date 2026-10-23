import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import ReviewPage from '../page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/review',
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

const draft = {
  state: 'Virginia',
  recipient: 'myself',
  patientFirstName: 'Jane',
  patientLastName: 'Doe',
  patientDateOfBirth: '1990-11-01',
  email: 'jane@example.com',
  phone: '5551234567',
  notePurpose: 'work',
  firstDayOff: '2026-11-01',
  lastDayOff: '2026-11-03',
  absenceReason: 'Feeling sick',
  symptoms: ['Fever or chills'],
}

function savedDraft(): Record<string, unknown> {
  const calls = vi.mocked(localStorage.setItem).mock.calls
  return JSON.parse(calls[calls.length - 1][1])
}

describe('review page consent', () => {
  it('saves both consents to the draft that checkout sends', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(draft))
    const user = userEvent.setup()
    const { container } = render(
      <I18nProvider>
        <ReviewPage />
      </I18nProvider>
    )

    await user.click(container.querySelector('#certifyAccurate')!)
    await user.click(container.querySelector('#agreeTerms')!)
    await user.click(screen.getByRole('button', { name: /continue to payment/i }))

    await waitFor(() => expect(localStorage.setItem).toHaveBeenCalled())
    expect(savedDraft()).toMatchObject({
      certifyAccurate: true,
      agreeTerms: true,
      smsOptIn: false,
    })
  })
})
