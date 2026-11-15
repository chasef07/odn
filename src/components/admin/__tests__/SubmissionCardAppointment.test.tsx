import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Submission } from '@/db/types'
import { SubmissionCard } from '../SubmissionCard'

vi.mock('@/components/admin/PatientHistoryPopup', () => ({ PatientHistoryPopup: () => null }))
vi.mock('@/components/admin/RemoveGuardianModeControl', () => ({
  RemoveGuardianModeControl: () => null,
}))

const submission = {
  id: 'sub-1',
  status: 'PENDING_REVIEW',
  recipient: 'myself',
  state: 'Virginia',
  patientFirstName: 'Jane',
  patientLastName: 'Doe',
  patientDateOfBirth: new Date('1990-11-01T00:00:00.000Z'),
  guardianFirstName: null,
  guardianLastName: null,
  guardianDateOfBirth: null,
  email: 'jane@example.com',
  phone: '(555) 123-4567',
  notePurpose: 'work',
  otherNotePurpose: null,
  firstDayOff: new Date('2026-11-01T00:00:00.000Z'),
  lastDayOff: new Date('2026-11-01T00:00:00.000Z'),
  absenceReason: "Doctor's appointment",
  otherAbsenceReason: null,
  appointmentType: 'Eye exam',
  symptoms: [],
  otherSymptomText: null,
  additionalInformation: null,
  createdAt: new Date('2026-11-01T12:00:00.000Z'),
} as unknown as Submission

describe('SubmissionCard appointment type', () => {
  it("shows the kind of appointment on a Doctor's appointment chart", () => {
    render(<SubmissionCard submission={submission} currentIndex={0} totalCount={1} />)

    expect(screen.getByText('Appointment type:')).toBeInTheDocument()
    expect(screen.getByText('Eye exam')).toBeInTheDocument()
  })

  it('hides an appointment type left on a chart with another reason', () => {
    render(
      <SubmissionCard
        submission={{ ...submission, absenceReason: 'Feeling sick' }}
        currentIndex={0}
        totalCount={1}
      />
    )

    expect(screen.queryByText('Appointment type:')).not.toBeInTheDocument()
    expect(screen.queryByText('Eye exam')).not.toBeInTheDocument()
  })
})
