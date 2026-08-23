import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MaybeReasonDialog } from '../MaybeReasonDialog'

describe('MaybeReasonDialog', () => {
  it('offers More Info Needed as an explicit email-sending action', async () => {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
    const user = userEvent.setup()

    render(
      <MaybeReasonDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isLoading={false}
        error={null}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Maybe Reason' }))
    await user.click(await screen.findByRole('option', { name: 'More Info Needed' }))

    expect(screen.getByRole('combobox', { name: 'Maybe Reason' })).toHaveTextContent(
      'More Info Needed'
    )
    expect(
      screen.getByText('Request additional details for the chart and doctor review.')
    ).toBeVisible()
    expect(screen.getByText('Email will be sent')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Move to Maybe & Send Email' })).toBeEnabled()
  })
})
