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

describe('AfterVisitSummaryButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendAfterVisitSummary.mockResolvedValue({ success: true })
  })

  it('leaves additional information out unless toggled on', async () => {
    const user = userEvent.setup()
    render(
      <AfterVisitSummaryButton submissionId="sub_123" additionalInformation="Saw urgent care" />
    )

    await user.click(screen.getByRole('button', { name: 'After Visit Summary' }))
    expect(screen.getByRole('switch', { name: 'Include additional information' })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Generate & Send' }))

    expect(mockSendAfterVisitSummary).toHaveBeenCalledWith('sub_123', {
      includeAdditionalInformation: false,
    })
    expect(
      await screen.findByText('After-visit summary sent to hello@onlinedoctornote.com.')
    ).toBeVisible()
  })

  it('includes additional information when toggled on', async () => {
    const user = userEvent.setup()
    render(
      <AfterVisitSummaryButton submissionId="sub_123" additionalInformation="Saw urgent care" />
    )

    await user.click(screen.getByRole('button', { name: 'After Visit Summary' }))
    await user.click(screen.getByRole('switch', { name: 'Include additional information' }))
    await user.click(screen.getByRole('button', { name: 'Generate & Send' }))

    expect(mockSendAfterVisitSummary).toHaveBeenCalledWith('sub_123', {
      includeAdditionalInformation: true,
    })
  })

  it('hides the toggle when the chart has no additional information', async () => {
    const user = userEvent.setup()
    render(<AfterVisitSummaryButton submissionId="sub_123" additionalInformation={null} />)

    await user.click(screen.getByRole('button', { name: 'After Visit Summary' }))

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('shows the error when sending fails', async () => {
    mockSendAfterVisitSummary.mockResolvedValue({ success: false, error: 'Resend is down' })
    const user = userEvent.setup()
    render(<AfterVisitSummaryButton submissionId="sub_123" additionalInformation={null} />)

    await user.click(screen.getByRole('button', { name: 'After Visit Summary' }))
    await user.click(screen.getByRole('button', { name: 'Generate & Send' }))

    expect(await screen.findByText('Resend is down')).toBeVisible()
  })
})
