import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApprovalDialogContent } from '../ApprovalDialogContent'

describe('ApprovalDialogContent', () => {
  it('offers no evaluation date before 1900', () => {
    render(<ApprovalDialogContent evaluationDate="2026-10-18" onDateChange={vi.fn()} />)

    expect(screen.getByLabelText('Evaluation Date (for PDF)')).toHaveAttribute('min', '1900-01-01')
  })
})
