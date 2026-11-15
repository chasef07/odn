import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import AbsenceReasonPage from '@/app/absence-reason/page'
import { I18nProvider } from '@/components/i18n/I18nProvider'

const navigation = vi.hoisted(() => ({ pathname: '/absence-reason', push: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: vi.fn() }),
}))

const QUESTION = "What kind of doctor's appointment did you have?"

const DRAFT_KEY = 'doctor-note-form-draft'

function renderWithDraft(draft: Record<string, unknown>) {
  let stored = JSON.stringify(draft)
  ;(localStorage.getItem as Mock).mockImplementation((key: string) =>
    key === DRAFT_KEY ? stored : null
  )
  ;(localStorage.setItem as Mock).mockImplementation((key: string, value: string) => {
    if (key === DRAFT_KEY) stored = value
  })
  render(
    <I18nProvider>
      <AbsenceReasonPage />
    </I18nProvider>
  )
}

function savedDraft(): Record<string, unknown> {
  const calls = (localStorage.setItem as Mock).mock.calls
  return JSON.parse(calls[calls.length - 1][1])
}

describe('absence reason appointment question', () => {
  beforeEach(() => {
    navigation.pathname = '/absence-reason'
    navigation.push.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
  })

  it("asks what kind of appointment only once Doctor's appointment is chosen", async () => {
    const user = userEvent.setup()
    renderWithDraft({ recipient: 'myself' })

    expect(screen.queryByLabelText(QUESTION)).not.toBeInTheDocument()

    await user.click(screen.getByLabelText("Doctor's appointment"))
    expect(screen.getByLabelText(QUESTION)).toHaveAttribute('aria-required', 'true')

    await user.click(screen.getByLabelText('Feeling sick'))
    expect(screen.queryByLabelText(QUESTION)).not.toBeInTheDocument()
  })

  it('blocks Continue until the appointment is described, then saves the answer', async () => {
    const user = userEvent.setup()
    renderWithDraft({ recipient: 'myself' })

    await user.click(screen.getByLabelText("Doctor's appointment"))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText('Please tell us what kind of appointment you had')
    ).toBeInTheDocument()
    expect(navigation.push).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(QUESTION), 'Dentist')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/additional-info'))
    expect(savedDraft()).toMatchObject({
      absenceReason: "Doctor's appointment",
      appointmentType: 'Dentist',
    })
  })

  it('asks the question in Spanish on the Spanish flow', async () => {
    const user = userEvent.setup()
    navigation.pathname = '/es/absence-reason'
    renderWithDraft({ recipient: 'myself' })

    await user.click(screen.getByLabelText('Cita médica'))

    expect(screen.getByLabelText('¿Qué tipo de cita médica tuvo?')).toHaveAttribute(
      'placeholder',
      'Por ejemplo: dentista, examen de la vista, fisioterapia'
    )
  })
})
