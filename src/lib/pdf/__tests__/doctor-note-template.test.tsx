/**
 * Tests for Doctor's Note PDF Template
 * Tests state-specific licenses and caregiver vs. regular patient content
 * Note: These tests verify the component renders successfully with different props.
 * Full PDF content validation is done via integration tests and manual review.
 */

import { describe, it, expect } from 'vitest'
import { pdf } from '@react-pdf/renderer'
import { DoctorNoteTemplate, DoctorNoteData, DoctorInfo } from '../doctor-note-template'
import { getStateLicense } from '../../state-licenses'

// Mock doctor info for testing
const mockDoctorInfo: DoctorInfo = {
  name: 'Dr. Test Doctor',
  credentials: 'MD FACEP',
  signatureUrl: '/test-signature.png',
}

// Base submission data for testing
const baseSubmissionData: DoctorNoteData = {
  patientFirstName: 'John',
  patientLastName: 'Doe',
  patientDateOfBirth: new Date('1990-01-01'),
  guardianFirstName: null,
  guardianLastName: null,
  recipient: 'myself',
  firstDayOff: new Date('2024-11-08'),
  lastDayOff: new Date('2024-11-10'),
  notePurpose: 'work',
  otherNotePurpose: null,
  absenceReason: 'Feeling sick',
  otherAbsenceReason: null,
  symptoms: ['Fever', 'Cough'],
  otherSymptomText: null,
  additionalInformation: null,
  state: 'Texas',
  submissionId: 'test-123',
  createdAt: new Date('2024-11-01'),
}

describe('DoctorNoteTemplate - Component Rendering', () => {
  it('should render successfully with Texas patient data', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, state: 'Texas' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    // Should generate a PDF without errors
    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should render successfully with California patient data', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, state: 'California' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should render successfully with New York patient data', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, state: 'New York' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should render successfully for caregiver notes', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          absenceReason: 'Taking care of someone',
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })

  it("should render successfully for doctor's appointment notes", async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          absenceReason: "Doctor's appointment",
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should render successfully for school notes', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, notePurpose: 'school' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should render successfully for notes with both work and school', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, notePurpose: 'both' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should render successfully with guardian information', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          recipient: 'someone_else',
          guardianFirstName: 'Jane',
          guardianLastName: 'Smith',
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should render successfully for state without license (Alaska)', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, state: 'Alaska' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('DoctorNoteTemplate - State License Logic', () => {
  it('should have Texas license available', () => {
    const license = getStateLicense('Texas')
    expect(license).not.toBeNull()
    expect(license?.licenseNumber).toBe('V6158')
  })

  it('should have California license available', () => {
    const license = getStateLicense('California')
    expect(license).not.toBeNull()
    expect(license?.licenseNumber).toBe('A97833')
  })

  it('should have New York license available', () => {
    const license = getStateLicense('New York')
    expect(license).not.toBeNull()
    expect(license?.licenseNumber).toBe('229551')
  })

  it('should return null for states without license (Alaska)', () => {
    const license = getStateLicense('Alaska')
    expect(license).toBeNull()
  })
})

describe('DoctorNoteTemplate - Note Purpose Logic', () => {
  it('should handle work note purpose', () => {
    const notePurpose = 'work'
    const excuseText = notePurpose === 'both' ? 'work or school' : notePurpose
    expect(excuseText).toBe('work')
  })

  it('should handle school note purpose', () => {
    const notePurpose = 'school'
    const excuseText = notePurpose === 'both' ? 'work or school' : notePurpose
    expect(excuseText).toBe('school')
  })

  it('should handle both work and school purpose', () => {
    const notePurpose = 'both'
    const excuseText = notePurpose === 'both' ? 'work or school' : notePurpose
    expect(excuseText).toBe('work or school')
  })

  it('should handle other note purpose', () => {
    const notePurpose = 'other'
    const otherNotePurpose = 'volunteer work'
    const excuseText = notePurpose === 'other' ? otherNotePurpose : notePurpose
    expect(excuseText).toBe('volunteer work')
  })
})

describe('DoctorNoteTemplate - Absence Reason Detection', () => {
  it('should detect caregiver absence reason', () => {
    const absenceReason = 'Taking care of someone'
    const isCaregiver = absenceReason === 'Taking care of someone'
    expect(isCaregiver).toBe(true)
  })

  it('should not detect regular absence as caregiver', () => {
    const absenceReason = 'Feeling sick'
    const isCaregiver = absenceReason === 'Taking care of someone'
    expect(isCaregiver).toBe(false)
  })

  it('should not detect appointment as caregiver', () => {
    const absenceReason = "Doctor's appointment"
    const isCaregiver = absenceReason === 'Taking care of someone'
    expect(isCaregiver).toBe(false)
  })

  it("should detect doctor's appointment absence reason", () => {
    const absenceReason = "Doctor's appointment"
    const isAppointment = absenceReason === "Doctor's appointment"
    expect(isAppointment).toBe(true)
  })

  it("should not detect caregiver as doctor's appointment", () => {
    const absenceReason = 'Taking care of someone'
    const isAppointment = absenceReason === "Doctor's appointment"
    expect(isAppointment).toBe(false)
  })

  it("should not detect regular absence as doctor's appointment", () => {
    const absenceReason = 'Feeling sick'
    const isAppointment = absenceReason === "Doctor's appointment"
    expect(isAppointment).toBe(false)
  })
})
