import { describe, it, expect } from 'vitest'
import { pdf } from '@react-pdf/renderer'
import {
  DoctorNoteTemplate,
  DoctorNoteData,
  DoctorInfo,
  getConditionPhrase,
} from '../doctor-note-template'
import { getStateLicense } from '../../state-licenses'

const mockDoctorInfo: DoctorInfo = {
  name: 'Dr. Test Doctor',
  credentials: 'MD FACEP',
  signatureUrl: '/test-signature.png',
}

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
  })
})

function extractText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    const element = node as { type: unknown; props: { children?: unknown } }
    if (typeof element.type === 'function') {
      const rendered = (element.type as (props: unknown) => unknown)(element.props)
      return extractText(rendered)
    }
    return extractText(element.props.children)
  }
  return ''
}

function hasLinkWithSrc(node: unknown, src: string): boolean {
  if (node === null || node === undefined || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some((child) => hasLinkWithSrc(child, src))

  if ('props' in (node as Record<string, unknown>)) {
    const element = node as { type: unknown; props: { children?: unknown; src?: string } }
    if (typeof element.type === 'function') {
      const rendered = (element.type as (props: unknown) => unknown)(element.props)
      return hasLinkWithSrc(rendered, src)
    }
    return (
      (element.type === 'LINK' && element.props.src === src) ||
      hasLinkWithSrc(element.props.children, src)
    )
  }

  return false
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

  it('says "may return to work and school" for notes covering both', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{ ...baseSubmissionData, notePurpose: 'both' }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    expect(extractText(tree)).toContain('may return to work and school')
  })

  it('names no activity in "may return" for other notes', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          notePurpose: 'other',
          otherNotePurpose: 'volunteer work',
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    expect(extractText(tree)).toContain('may return after')
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
  it('uses the canonical clinic name and contact email', () => {
    const tree = (
      <DoctorNoteTemplate
        submissionData={baseSubmissionData}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)

    expect(text).toContain('Platinum Health Clinic')
    expect(text).toContain('hello@platinumhealthclinic.com')
    expect(hasLinkWithSrc(tree, 'mailto:hello@platinumhealthclinic.com')).toBe(true)
  })

  it('renders QR-only verification copy with a clickable QR link when verification info is provided', async () => {
    const verificationUrl = 'https://onlinedoctornote.com/verify/v_test'
    const tree = (
      <DoctorNoteTemplate
        submissionData={baseSubmissionData}
        doctorInfo={{ ...mockDoctorInfo, signatureUrl: '', npi: '1234567890' }}
        issueDate={new Date('2024-11-08')}
        verificationInfo={{
          medicalRecordNumber: 'A7B3C9D2',
          verificationUrl,
          qrCodeDataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        }}
      />
    )

    const text = extractText(tree)
    expect(text).toContain('Document Verification')
    expect(text).toContain('Scan or click on the QR code to verify this note:')
    expect(text).not.toContain('visit the secure URL')
    expect(text).not.toContain(verificationUrl)
    expect(hasLinkWithSrc(tree, verificationUrl)).toBe(true)

    const doc = pdf(tree)
    const pdfText = await doc.toString()
    expect(pdfText).toContain(`/URI (${verificationUrl})`)

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
    const tree = (
      <DoctorNoteTemplate
        submissionData={{
          ...baseSubmissionData,
          absenceReason: 'Taking care of someone',
        }}
        doctorInfo={mockDoctorInfo}
        issueDate={new Date('2024-11-08')}
      />
    )
    const text = extractText(tree)
    expect(text).toContain('attend to their family member with a medical condition')
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
    expect(text).not.toContain('medical condition')
    expect(text).not.toContain('due to an illness')
    expect(text).not.toContain('due to an injury')
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
