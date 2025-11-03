import { Prisma } from '@prisma/client'
import { FormData } from '@/lib/form-storage'

/**
 * Create test FormData with sensible defaults
 * Override any fields as needed
 */
export function createTestFormData(overrides?: Partial<FormData>): FormData {
  const timestamp = Date.now()

  return {
    // Page 1 - State Selection
    state: 'CA',

    // Page 2 - Recipient
    recipient: 'myself',

    // Page 3 - Patient Info
    patientFirstName: 'Test',
    patientLastName: 'User',
    patientDateOfBirth: '1990-01-01',

    // Page 4 - Guardian Info (conditional)
    guardianFirstName: undefined,
    guardianLastName: undefined,
    guardianDateOfBirth: undefined,

    // Page 5 - Contact Info
    email: `test-${timestamp}@example.com`,
    phone: '5555551234',

    // Page 6 - Note Purpose
    notePurpose: 'work',
    otherNotePurpose: undefined,

    // Page 7 - Absence Dates
    firstDayOff: '2025-11-01',
    lastDayOff: '2025-11-02',

    // Page 8 - Absence Reason
    absenceReason: 'Feeling sick',
    otherAbsenceReason: undefined,

    // Page 9 - Symptoms
    symptoms: ['Fever', 'Cough'],
    otherSymptomText: undefined,

    // Page 10 - Additional Info
    additionalInformation: undefined,

    // Page 11 - Review & Terms
    certifyAccurate: true,
    agreeTerms: true,

    ...overrides,
  }
}

/**
 * Create test Submission data for Prisma
 * Override any fields as needed
 */
export function createTestSubmissionData(
  overrides?: Partial<Prisma.SubmissionCreateInput>
): Prisma.SubmissionCreateInput {
  const timestamp = Date.now()

  return {
    stripePaymentIntentId: `pi_test_${timestamp}`,
    status: 'pending_review',
    state: 'CA',
    recipient: 'myself',
    patientFirstName: 'Test',
    patientLastName: 'User',
    patientDateOfBirth: new Date('1990-01-01'),
    email: `test-${timestamp}@example.com`,
    phone: '5555551234',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-01'),
    lastDayOff: new Date('2025-11-02'),
    absenceReason: 'Feeling sick',
    symptoms: ['Fever', 'Cough'],
    ...overrides,
  }
}

/**
 * Create test TemporarySubmission data for Prisma
 * Override any fields as needed
 */
export function createTestTempSubmissionData(
  overrides?: Partial<Prisma.TemporarySubmissionCreateInput>
): Prisma.TemporarySubmissionCreateInput {
  const timestamp = Date.now()
  const formData = createTestFormData()

  return {
    paymentIntentId: `pi_test_temp_${timestamp}`,
    formData: formData as unknown as Prisma.InputJsonValue,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    ...overrides,
  }
}

/**
 * Create test Submission with guardian info (recipient = 'someone_else')
 */
export function createTestSubmissionWithGuardian(
  overrides?: Partial<Prisma.SubmissionCreateInput>
): Prisma.SubmissionCreateInput {
  const timestamp = Date.now()

  return createTestSubmissionData({
    recipient: 'someone_else',
    patientDateOfBirth: new Date('2010-01-01'), // Minor
    guardianFirstName: 'Parent',
    guardianLastName: 'Guardian',
    guardianDateOfBirth: new Date('1980-01-01'),
    ...overrides,
  })
}

/**
 * Create expired TemporarySubmission for testing cleanup
 */
export function createExpiredTempSubmission(
  overrides?: Partial<Prisma.TemporarySubmissionCreateInput>
): Prisma.TemporarySubmissionCreateInput {
  const timestamp = Date.now()
  const formData = createTestFormData()

  return {
    paymentIntentId: `pi_test_expired_${timestamp}`,
    formData: formData as unknown as Prisma.InputJsonValue,
    expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    ...overrides,
  }
}

/**
 * Create test FormData with all optional fields filled
 */
export function createTestFormDataComplete(): FormData {
  return createTestFormData({
    recipient: 'someone_else',
    guardianFirstName: 'Parent',
    guardianLastName: 'Guardian',
    guardianDateOfBirth: '1980-01-01',
    notePurpose: 'other',
    otherNotePurpose: 'Personal matter',
    absenceReason: 'Other',
    otherAbsenceReason: 'Family emergency',
    symptoms: ['Fever', 'Cough', 'Other'],
    otherSymptomText: 'Custom symptom',
    additionalInformation: 'Additional details here',
  })
}

/**
 * Create test FormData with minimum required fields
 */
export function createTestFormDataMinimal(): FormData {
  const timestamp = Date.now()

  return {
    state: 'CA',
    recipient: 'myself',
    patientFirstName: 'Test',
    patientLastName: 'User',
    patientDateOfBirth: '1990-01-01',
    email: `test-${timestamp}@example.com`,
    phone: '5555551234',
    notePurpose: 'work',
    firstDayOff: '2025-11-01',
    lastDayOff: '2025-11-02',
    absenceReason: 'Feeling sick',
    certifyAccurate: true,
    agreeTerms: true,
  }
}

/**
 * Create multiple test submissions at once
 * Useful for testing queries and pagination
 */
export function createMultipleTestSubmissions(count: number): Prisma.SubmissionCreateInput[] {
  return Array.from({ length: count }, (_, i) => {
    const timestamp = Date.now() + i

    return createTestSubmissionData({
      stripePaymentIntentId: `pi_test_${timestamp}_${i}`,
      email: `test-${timestamp}-${i}@example.com`,
      status: i % 3 === 0 ? 'approved' : i % 3 === 1 ? 'pending_review' : 'denied',
      createdAt: new Date(Date.now() - i * 1000 * 60 * 60), // Stagger creation times
    })
  })
}
