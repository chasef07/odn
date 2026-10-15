import { describe, expect, it, type Mock } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormProgress } from '@/components/form-progress'

function withDraft(draft: Record<string, unknown>) {
  ;(localStorage.getItem as Mock).mockReturnValue(JSON.stringify(draft))
}

describe('FormProgress', () => {
  it('counts only the steps this draft will visit', () => {
    withDraft({ recipient: 'myself', absenceReason: "Doctor's appointment" })
    render(<FormProgress route="/additional-info" />)
    expect(screen.getByText('Step 8 of 9')).toBeInTheDocument()
    expect(screen.getByText('80% complete')).toBeInTheDocument()
  })

  it('counts the guardian step for someone else', () => {
    withDraft({ recipient: 'someone_else', absenceReason: 'Feeling sick' })
    render(<FormProgress route="/review" />)
    expect(screen.getByText('Step 11 of 11')).toBeInTheDocument()
  })

  it('starts at step one with an empty draft', () => {
    withDraft({})
    render(<FormProgress route="/get-started" />)
    expect(screen.getByText('Step 1 of 10')).toBeInTheDocument()
  })
})
