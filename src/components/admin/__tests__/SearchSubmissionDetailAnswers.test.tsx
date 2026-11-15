import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormattedSubmission } from '@/app/admin/_actions/search'
import { SearchSubmissionDetail } from '../SearchSubmissionDetail'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/components/admin/PatientHistoryPopup', () => ({ PatientHistoryPopup: () => null }))
vi.mock('@/components/admin/RemoveGuardianModeControl', () => ({
  RemoveGuardianModeControl: () => null,
}))
vi.mock('@/components/admin/AfterVisitSummaryButton', () => ({
  AfterVisitSummaryButton: () => null,
}))
vi.mock('@/app/admin/_actions/edits', () => ({ updateSubmission: vi.fn() }))
vi.mock('@/app/admin/_actions/approve', () => ({
  approveSubmission: vi.fn(),
  reApproveSubmission: vi.fn(),
}))
vi.mock('@/app/admin/_actions/deny', () => ({ denySubmission: vi.fn() }))
vi.mock('@/app/admin/_actions/change-status', () => ({ changeSubmissionStatus: vi.fn() }))
vi.mock('@/app/admin/support/_actions/tickets', () => ({
  createSupportTicketFromSubmission: vi.fn(),
}))

const submission = {
  id: 'sub-1',
  status: 'PENDING_REVIEW',
  recipient: 'myself',
  state: 'Virginia',
  patientFirstName: 'Jane',
  patientLastName: 'Doe',
  patientDateOfBirth: '1990-11-01',
  guardianFirstName: null,
  guardianLastName: null,
  guardianDateOfBirth: null,
  email: 'jane@example.com',
  phone: '(555) 123-4567',
  smsOptIn: false,
  notePurpose: 'work',
  otherNotePurpose: null,
  firstDayOff: '2026-11-01',
  lastDayOff: '2026-11-01',
  absenceReason: 'Accident or injury',
  otherAbsenceReason: null,
  appointmentType: null,
  symptoms: ['Fall', 'Other'],
  otherSymptomText: 'Twisted ankle on stairs',
  additionalInformation: null,
  denialReason: null,
  denialNote: null,
  stripePaymentIntentId: null,
  stripeRefundId: null,
  reviewedAt: null,
  createdAt: new Date('2026-11-01T12:00:00.000Z'),
  updatedAt: new Date('2026-11-01T12:00:00.000Z'),
  noteVerifications: [],
  smsMessages: [],
  smsOptOutAt: null,
  smsPhoneE164: null,
} as unknown as FormattedSubmission

function answer(heading: string): string | null {
  return screen.getByText(heading).parentElement?.querySelector('p')?.textContent ?? null
}

describe('SearchSubmissionDetail intake answers', () => {
  it('shows the Other symptom once, with the text the patient wrote', () => {
    render(<SearchSubmissionDetail submission={submission} />)

    expect(answer('Symptoms (comma-separated)')).toBe('Fall, Other: Twisted ankle on stairs')
  })

  it('shows the text the patient wrote for an Other purpose and reason', () => {
    render(
      <SearchSubmissionDetail
        submission={{
          ...submission,
          notePurpose: 'other',
          otherNotePurpose: 'Volunteering',
          absenceReason: 'Other',
          otherAbsenceReason: 'Dental procedure',
          symptoms: [],
          otherSymptomText: null,
        }}
      />
    )

    expect(answer('Note Purpose')).toBe('Other: Volunteering')
    expect(answer('Reason')).toBe('Other: Dental procedure')
  })

  it('hides Other text left on a chart whose answer is no longer Other', () => {
    render(
      <SearchSubmissionDetail
        submission={{
          ...submission,
          otherNotePurpose: 'Volunteering',
          otherAbsenceReason: 'Dental procedure',
          symptoms: ['Fall'],
        }}
      />
    )

    expect(answer('Note Purpose')).toBe('Work')
    expect(answer('Reason')).toBe('Accident or injury')
    expect(answer('Symptoms (comma-separated)')).toBe('Fall')
  })
})
