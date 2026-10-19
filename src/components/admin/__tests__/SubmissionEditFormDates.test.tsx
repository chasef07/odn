import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormattedSubmission } from '@/app/admin/_actions/search'
import { dateOnlyFromUtcDate, parseDateOnly, type DateOnly } from '@/lib/dates'
import { SubmissionEditForm } from '../SubmissionEditForm'

const { mockUpdateSubmission } = vi.hoisted(() => ({ mockUpdateSubmission: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/app/admin/_actions/edits', () => ({
  updateSubmission: mockUpdateSubmission,
  removeGuardianFromAdultSubmission: vi.fn(),
}))
vi.mock('@/app/admin/_actions/approve', () => ({ approveSubmission: vi.fn() }))

function day(value: string): DateOnly {
  const parsed = parseDateOnly(value)
  if (!parsed) throw new Error(`bad fixture ${value}`)
  return parsed
}

const submission = {
  id: 'sub-1',
  patientFirstName: 'Jane',
  patientLastName: 'Doe',
  patientDateOfBirth: day('1990-11-01'),
  guardianFirstName: null,
  guardianLastName: null,
  guardianDateOfBirth: null,
  recipient: 'myself',
  email: 'jane@example.com',
  phone: '(555) 123-4567',
  state: 'Virginia',
  notePurpose: 'work',
  otherNotePurpose: null,
  firstDayOff: day('2026-11-01'),
  lastDayOff: day('2026-11-03'),
  absenceReason: 'Feeling sick',
  otherAbsenceReason: null,
  symptoms: [],
  otherSymptomText: null,
  additionalInformation: null,
  noteVerifications: [],
  smsMessages: [],
  smsOptOutAt: null,
  smsPhoneE164: null,
} as unknown as FormattedSubmission

describe('SubmissionEditForm dates', () => {
  beforeEach(() => {
    mockUpdateSubmission.mockReset()
    mockUpdateSubmission.mockResolvedValue({ success: true })
  })

  it('saves each edited calendar day as that day', async () => {
    render(<SubmissionEditForm submission={submission} />)
    fireEvent.change(document.getElementById('lastDayOff')!, { target: { value: '2026-11-04' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(mockUpdateSubmission).toHaveBeenCalledTimes(1))
    const data = mockUpdateSubmission.mock.calls[0][1]
    expect(dateOnlyFromUtcDate(data.patientDateOfBirth)).toBe('1990-11-01')
    expect(dateOnlyFromUtcDate(data.firstDayOff)).toBe('2026-11-01')
    expect(dateOnlyFromUtcDate(data.lastDayOff)).toBe('2026-11-04')
    expect(data.guardianDateOfBirth).toBeNull()
  })

  it('refuses to save a cleared day instead of sending an invalid Date', async () => {
    render(<SubmissionEditForm submission={submission} />)
    fireEvent.change(document.getElementById('firstDayOff')!, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(
      await screen.findByText('Enter every date as a real calendar day, 1900 or later.')
    ).toBeInTheDocument()
    expect(mockUpdateSubmission).not.toHaveBeenCalled()
  })

  it('refuses to save a day before 1900', async () => {
    render(<SubmissionEditForm submission={submission} />)
    fireEvent.change(document.getElementById('firstDayOff')!, { target: { value: '0050-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(
      await screen.findByText('Enter every date as a real calendar day, 1900 or later.')
    ).toBeInTheDocument()
    expect(mockUpdateSubmission).not.toHaveBeenCalled()
  })

  it('offers no day before 1900 in any date field', () => {
    render(<SubmissionEditForm submission={submission} />)
    const inputs = Array.from(document.querySelectorAll('input[type="date"]'))

    expect(inputs.map((input) => input.id)).toContain('evaluationDate')
    for (const input of inputs) expect(input.getAttribute('min')).toBe('1900-01-01')
  })
})
