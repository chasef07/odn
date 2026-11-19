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

describe('SubmissionCard injured body part', () => {
  const injury = {
    ...submission,
    absenceReason: 'Accident or injury',
    appointmentType: null,
    injuryBodyPart: 'Left ankle',
    symptoms: ['Fall'],
  }

  it('shows the injured body part on an Accident or injury chart', () => {
    render(<SubmissionCard submission={injury} currentIndex={0} totalCount={1} />)

    expect(screen.getByText('Injured body part:')).toBeInTheDocument()
    expect(screen.getByText('Left ankle')).toBeInTheDocument()
  })

  it('hides an injured body part left on a chart with another reason', () => {
    render(
      <SubmissionCard
        submission={{ ...injury, absenceReason: 'Feeling sick' }}
        currentIndex={0}
        totalCount={1}
      />
    )

    expect(screen.queryByText('Injured body part:')).not.toBeInTheDocument()
    expect(screen.queryByText('Left ankle')).not.toBeInTheDocument()
  })
})

function noteRequestLine(label: string): string | null {
  return screen.getByText(label).parentElement?.textContent ?? null
}

describe('SubmissionCard Other answers', () => {
  it('shows the text the patient wrote for an Other symptom', () => {
    render(
      <SubmissionCard
        submission={{
          ...submission,
          absenceReason: 'Accident or injury',
          symptoms: ['Fall', 'Other'],
          otherSymptomText: 'Twisted ankle on stairs',
        }}
        currentIndex={0}
        totalCount={1}
      />
    )

    expect(noteRequestLine('Symptoms:')).toBe('Symptoms: Fall, Other: Twisted ankle on stairs')
  })

  it('shows the text the patient wrote for an Other purpose and reason', () => {
    render(
      <SubmissionCard
        submission={{
          ...submission,
          notePurpose: 'other',
          otherNotePurpose: 'Volunteering',
          absenceReason: 'Other',
          otherAbsenceReason: 'Dental procedure',
        }}
        currentIndex={0}
        totalCount={1}
      />
    )

    expect(noteRequestLine('Purpose:')).toBe('Purpose: Other: Volunteering')
    expect(noteRequestLine('Reason:')).toBe('Reason: Other: Dental procedure')
  })
})
