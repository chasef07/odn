import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import AbsenceDatesPage from '../page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/absence-dates',
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

function savedDraft(): Record<string, unknown> {
  const calls = vi.mocked(localStorage.setItem).mock.calls
  return JSON.parse(calls[calls.length - 1][1])
}

function renderPage(draft: Record<string, unknown> = {}) {
  vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(draft))
  return render(
    <I18nProvider>
      <AbsenceDatesPage />
    </I18nProvider>
  )
}

describe('absence dates page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-30T12:00:00Z') })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the picked first day and day count as a date range', async () => {
    const user = userEvent.setup()
    renderPage({ notePurpose: 'work' })

    expect(screen.getByText('Which days do you need off work?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'Yesterday' }))
    await user.click(screen.getByRole('radio', { name: '2 days' }))

    expect(screen.getByText(/You'll be covered/)).toHaveTextContent(
      "You'll be covered Thursday, October 29 through Friday, October 30 · back to work Saturday, October 31"
    )

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() =>
      expect(savedDraft()).toMatchObject({ firstDayOff: '2026-10-29', lastDayOff: '2026-10-30' })
    )
  })

  it('offers first days back to seven days ago and no further', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Earlier…' }))

    expect(screen.queryByRole('radio', { name: 'Thu 22' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Fri 23' }))
    await user.click(screen.getByRole('radio', { name: '7 days' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() =>
      expect(savedDraft()).toMatchObject({ firstDayOff: '2026-10-23', lastDayOff: '2026-10-29' })
    )
  })

  it('keeps the day count when the first day changes', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('radio', { name: '3 days' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'Today' }))
    await user.click(screen.getByRole('radio', { name: '3 days' }))
    await user.click(screen.getByRole('radio', { name: 'Yesterday' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() =>
      expect(savedDraft()).toMatchObject({ firstDayOff: '2026-10-29', lastDayOff: '2026-10-31' })
    )
  })

  it('restores a saved recent range as picked chips', () => {
    renderPage({ firstDayOff: '2026-10-28', lastDayOff: '2026-10-30' })

    expect(screen.getByRole('radio', { name: 'Wed 28' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '3 days' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('opens a saved range the chips cannot show as exact dates, and clears it for the chips', async () => {
    const user = userEvent.setup()
    renderPage({ firstDayOff: '2026-11-02', lastDayOff: '2026-11-03' })

    expect(screen.getByLabelText('First Day Off')).toHaveValue('2026-11-02')
    expect(screen.getByLabelText('Last Day Off')).toHaveValue('2026-11-03')

    await user.click(screen.getByRole('button', { name: /Pick from recent days instead/ }))

    expect(screen.getByRole('radio', { name: 'Today' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
})
