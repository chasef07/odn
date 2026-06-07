import { describe, expect, it } from 'vitest'
import { validatePaidSubmissionData } from '../paid-submission-validation'
import { LEGAL_NOTE_PURPOSE_ERROR } from '../validation-schemas'
import { FormData } from '../form-storage'

const validSubmissionData: FormData = {
  state: 'Virginia',
  recipient: 'myself',
  patientFirstName: 'John',
  patientLastName: 'Doe',
  patientDateOfBirth: '1990-01-01',
  email: 'john@example.com',
  phone: '5551234567',
  smsOptIn: true,
  notePurpose: 'work',
  firstDayOff: '2026-01-05',
  lastDayOff: '2026-01-06',
  absenceReason: 'Feeling sick',
}

describe('validatePaidSubmissionData', () => {
  it('rejects legal matters before payment or persistence', () => {
    const result = validatePaidSubmissionData({
      ...validSubmissionData,
      notePurpose: 'legal',
    })

    expect(result.canPersistSubmission).toBe(false)
    expect(result.errors).toContain(LEGAL_NOTE_PURPOSE_ERROR)
  })

  it('allows submissions without SMS consent', () => {
    const result = validatePaidSubmissionData({
      ...validSubmissionData,
      smsOptIn: false,
    })

    expect(result.canPersistSubmission).toBe(true)
    expect(result.errors).not.toContain('SMS consent is required to continue')
  })
})
