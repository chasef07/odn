import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSendAfterVisitSummary } = vi.hoisted(() => ({
  mockSendAfterVisitSummary: vi.fn(),
}))

vi.mock('@/app/admin/_actions/after-visit-summary', () => ({
  sendAfterVisitSummary: mockSendAfterVisitSummary,
}))

import { AfterVisitSummaryButton } from '../AfterVisitSummaryButton'

const answers = {
  otherAbsenceReason: 'Dental procedure',
  additionalInformation: 'Saw urgent care',
}

async function openDialog(freeTextAnswers: Record<string, string> = answers) {
  const user = userEvent.setup()
  render(<AfterVisitSummaryButton submissionId="sub_123" freeTextAnswers={freeTextAnswers} />)
  await user.click(screen.getByRole('button', { name: 'After Visit Summary' }))
  return user
}

describe('AfterVisitSummaryButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendAfterVisitSummary.mockResolvedValue({ success: true })
  })

  it('shows a switch per free-text answer, all off, and sends none of them by default', async () => {
    const user = await openDialog()

    expect(screen.getByRole('switch', { name: 'Include other absence reason' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Include additional information' })).not.toBeChecked()
    expect(screen.queryByRole('switch', { name: 'Include other symptom' })).not.toBeInTheDocument()
    expect(screen.getByText('Dental procedure')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Generate & Send' }))

    expect(mockSendAfterVisitSummary).toHaveBeenCalledWith('sub_123', { freeText: {} })
    expect(
      await screen.findByText('After-visit summary sent to hello@onlinedoctornote.com.')
    ).toBeVisible()
  })

  it('sends the patient text of an answer switched on', async () => {
    const user = await openDialog()

    await user.click(screen.getByRole('switch', { name: 'Include additional information' }))
    await user.click(screen.getByRole('button', { name: 'Generate & Send' }))

    expect(mockSendAfterVisitSummary).toHaveBeenCalledWith('sub_123', {
      freeText: { additionalInformation: 'Saw urgent care' },
    })
  })

  it('sends the edited text of an answer switched on', async () => {
    const user = await openDialog()

    await user.click(screen.getByRole('switch', { name: 'Include other absence reason' }))
    const box = screen.getByRole('textbox', { name: 'Other absence reason for the summary' })
    expect(box).toHaveValue('Dental procedure')
    await user.clear(box)
    await user.type(box, 'Wisdom tooth removal')
    await user.click(screen.getByRole('button', { name: 'Generate & Send' }))

    expect(mockSendAfterVisitSummary).toHaveBeenCalledWith('sub_123', {
      freeText: { otherAbsenceReason: 'Wisdom tooth removal' },
    })
  })

  it('drops an edit when the answer is switched back off', async () => {
    const user = await openDialog()

    await user.click(screen.getByRole('switch', { name: 'Include other absence reason' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Other absence reason for the summary' }),
      ' edited'
    )
    await user.click(screen.getByRole('switch', { name: 'Include other absence reason' }))
    await user.click(screen.getByRole('button', { name: 'Generate & Send' }))

    expect(mockSendAfterVisitSummary).toHaveBeenCalledWith('sub_123', { freeText: {} })
  })

  it('blocks sending while an included answer is empty', async () => {
    const user = await openDialog()

    await user.click(screen.getByRole('switch', { name: 'Include additional information' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Additional information for the summary' })
    )

    expect(
      screen.getByText('An included answer is empty. Add text or switch it off.')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Generate & Send' })).toBeDisabled()
  })

  it('shows no switches when the chart has no free-text answers', async () => {
    await openDialog({})

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('shows the error when sending fails', async () => {
    mockSendAfterVisitSummary.mockResolvedValue({ success: false, error: 'Resend is down' })
    const user = await openDialog({})

    await user.click(screen.getByRole('button', { name: 'Generate & Send' }))

    expect(await screen.findByText('Resend is down')).toBeVisible()
  })
})
