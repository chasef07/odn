import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { GetStartedForm } from '../GetStartedForm'

vi.mock('next/navigation', () => ({
  usePathname: () => '/get-started',
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }))

function savedDraft(): Record<string, unknown> {
  const calls = vi.mocked(localStorage.setItem).mock.calls
  return JSON.parse(calls[calls.length - 1][1])
}

function renderForm(detectedState: string | null) {
  return render(
    <I18nProvider>
      <GetStartedForm detectedState={detectedState} />
    </I18nProvider>
  )
}

describe('get started detected state', () => {
  it('saves the detected state when the patient continues', async () => {
    const user = userEvent.setup()
    renderForm('Florida')

    expect(screen.getByText('Florida')).toBeInTheDocument()
    expect(screen.queryByLabelText('State')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(savedDraft().state).toBe('Florida'))
  })

  it('lets the patient pick another state, starting from the detected one', async () => {
    const user = userEvent.setup()
    renderForm('Florida')

    await user.click(screen.getByRole('button', { name: 'Choose a different state' }))
    const select = screen.getByLabelText('State')
    expect(select).toHaveValue('Florida')

    await user.selectOptions(select, 'Texas')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(savedDraft().state).toBe('Texas'))
  })

  it('shows the state picker when nothing was detected', () => {
    renderForm(null)

    expect(screen.getByLabelText('State')).toHaveValue('')
    expect(screen.queryByText(/detected/i)).not.toBeInTheDocument()
  })
})
