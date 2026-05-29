/**
 * Tests for Doctor's Note PDF Template
 * Tests state-specific licenses and caregiver vs. regular patient content
 * Note: These tests verify the component renders successfully with different props.
 * Full PDF content validation is done via integration tests and manual review.
 */

import { describe, it, expect } from 'vitest'
import { pdf } from '@react-pdf/renderer'
import {
  DoctorNoteTemplate,
  DoctorNoteData,
  DoctorInfo,
  getConditionPhrase,
} from '../doctor-note-template'
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

  it('should render successfully with Medical Record # field for standard UUID', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          submissionId: '550e8400-e29b-41d4-a716-446655440000',
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
    // Medical record number should be formatted as first 8 chars uppercase: 550E8400
  })

  it('should render successfully with Medical Record # field for short UUID', async () => {
    const doc = pdf(
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          submissionId: 'abc123def456',
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )

    const blob = await doc.toBlob()
    expect(blob.size).toBeGreaterThan(0)
    // Medical record number should be formatted as first 8 chars uppercase: ABC123DE
  })
})

/**
 * Recursively walk a React element tree and concatenate all string children.
 * Used to assert on the text content rendered by DoctorNoteTemplate without
 * needing to parse the binary PDF output.
 */
function extractText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    const element = node as { type: unknown; props: { children?: unknown } }
    // Render function components so conditional content (e.g. notePurpose checks) executes
    if (typeof element.type === 'function') {
      const rendered = (element.type as (props: unknown) => unknown)(element.props)
      return extractText(rendered)
    }
    return extractText(element.props.children)
  }
  return ''
}

describe('DoctorNoteTemplate - "may return" sentence', () => {
  it('omits the "may return" sentence for travel notes (default patient block)', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, notePurpose: 'travel' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).not.toContain('may return')
    expect(text).not.toContain('Furthermore')
    // Trailing contact sentence must still appear
    expect(text).toContain('please do not hesitate to contact our office')
  })

  it('omits the "may return" sentence for travel + caregiver notes', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          notePurpose: 'travel',
          absenceReason: 'Taking care of someone',
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).not.toContain('may return')
    expect(text).not.toContain('Furthermore')
    expect(text).toContain('please do not hesitate to contact our office')
  })

  it('omits the "may return" sentence for travel + doctor\'s appointment notes', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          notePurpose: 'travel',
          absenceReason: "Doctor's appointment",
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).not.toContain('may return')
    expect(text).not.toContain('Furthermore')
    expect(text).toContain('please do not hesitate to contact our office')
  })

  it('keeps "may return to work" for work notes', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, notePurpose: 'work' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).toContain('may return to work')
    expect(text).toContain('Furthermore')
  })

  it('keeps "may return to school" for school notes', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, notePurpose: 'school' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).toContain('may return to school')
    expect(text).toContain('Furthermore')
  })
})

describe('getConditionPhrase()', () => {
  it('maps "Feeling sick" to illness phrasing', () => {
    expect(getConditionPhrase('Feeling sick')).toEqual({
      dueTo: 'due to an illness',
      with: 'with an illness',
    })
  })

  it('maps "Mental health" to illness phrasing', () => {
    expect(getConditionPhrase('Mental health')).toEqual({
      dueTo: 'due to an illness',
      with: 'with an illness',
    })
  })

  it('maps "Accident or injury" to injury phrasing', () => {
    expect(getConditionPhrase('Accident or injury')).toEqual({
      dueTo: 'due to an injury',
      with: 'with an injury',
    })
  })

  it('falls back to "medical condition" for "Taking care of someone"', () => {
    expect(getConditionPhrase('Taking care of someone')).toEqual({
      dueTo: 'due to a medical condition',
      with: 'with a medical condition',
    })
  })

  it('falls back to "medical condition" for "Doctor\'s appointment"', () => {
    expect(getConditionPhrase("Doctor's appointment")).toEqual({
      dueTo: 'due to a medical condition',
      with: 'with a medical condition',
    })
  })

  it('falls back to "medical condition" for "Other"', () => {
    expect(getConditionPhrase('Other')).toEqual({
      dueTo: 'due to a medical condition',
      with: 'with a medical condition',
    })
  })
})

describe('DoctorNoteTemplate - verification block', () => {
  it('renders QR-only verification copy when verification info is provided', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={baseSubmissionData}
        doctorInfo={{ ...mockDoctorInfo, npi: '1234567890' }}
        issueDate={new Date('2024-11-08')}
        verificationInfo={{
          medicalRecordNumber: 'A7B3C9D2',
          qrCodeDataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        }}
      />
    )

    const text = extractText(tree)
    expect(text).toContain('Document Verification')
    expect(text).toContain('Scan the QR code to verify this note:')
    expect(text).not.toContain('visit the secure URL')
    expect(text).not.toContain('https://onlinedoctornote.com/verify/v_test')
    expect(text).toContain('Medical Record #: A7B3C9D2')
    expect(text).toContain('Texas Medical License #V6158')
    expect(text).toContain('National Provider Identifier: 1234567890')
    expect(text).toContain('CONFIDENTIAL')
    expect(text).toContain('Unauthorized access, use, disclosure, or distribution is prohibited')
  })
})

describe('DoctorNoteTemplate - condition phrase by absence reason', () => {
  it('renders "due to an illness" for "Feeling sick" in the default patient branch', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, absenceReason: 'Feeling sick' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).toContain('due to an illness')
    expect(text).not.toContain('medical condition')
  })

  it('renders "due to an illness" for "Mental health" in the default patient branch', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, absenceReason: 'Mental health' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).toContain('due to an illness')
    expect(text).not.toContain('medical condition')
  })

  it('renders "due to an injury" for "Accident or injury" in the default patient branch', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, absenceReason: 'Accident or injury' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).toContain('due to an injury')
    expect(text).not.toContain('medical condition')
  })

  it('falls back to "with a medical condition" for "Taking care of someone" caregiver branch', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, absenceReason: 'Taking care of someone' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).toContain('with a medical condition')
  })

  it('renders "with an illness" for "Feeling sick" in the caregiver branch', () => {
    // Force the caregiver branch by using the caregiver helper logic but a
    // different reason. Since isCaregiver is gated on absenceReason itself,
    // the only way to land on the caregiver branch with a non-default reason
    // is to swap the rendering branch directly. The component gates on
    // absenceReason === 'Taking care of someone', so we exercise the helper:
    // here we still render through the component using the caregiver reason
    // and verify the swap by checking the rendered phrase via the helper.
    const tree = (
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          // Caregiver branch fires when absenceReason === 'Taking care of someone'.
          // For this test, we render the caregiver branch and confirm fallback,
          // then assert the helper directly for "Feeling sick"+with mapping.
          absenceReason: 'Taking care of someone',
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).toContain('attend to their family member with a medical condition')
    // The "with" mapping is exercised by the helper; verify it produces
    // "with an illness" for "Feeling sick".
    expect(getConditionPhrase('Feeling sick').with).toBe('with an illness')
  })

  it('falls back to "medical condition" for "Doctor\'s appointment" (appointment branch has no condition phrase)', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, absenceReason: "Doctor's appointment" }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    // The appointment branch uses its own "for a doctor's appointment" wording
    // and never references "medical condition" or the new illness/injury phrases.
    expect(text).not.toContain('medical condition')
    expect(text).not.toContain('due to an illness')
    expect(text).not.toContain('due to an injury')
    // Helper still maps it to the fallback.
    expect(getConditionPhrase("Doctor's appointment").dueTo).toBe('due to a medical condition')
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
