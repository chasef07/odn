import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CompletionScreen } from '../CompletionScreen'

describe('CompletionScreen', () => {
  it('surfaces the last review warning when present', () => {
    render(
      <CompletionScreen
        approvedCount={0}
        deniedCount={0}
        maybeCount={1}
        warning="Submission moved to Maybe, but email notification failed to send"
        onReturnToDashboard={vi.fn()}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Submission moved to Maybe, but email notification failed to send'
    )
  })
})
