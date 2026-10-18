import { isAgeValid } from '@/lib/age-validators'
import { validateAbsenceDates } from '@/lib/date-validators'
import { isIsoDateOnlyInSaneRange, parseIsoDateOnlyAsUTCDate } from './date-only-147a48e'
import { FormData } from '@/lib/form-storage'
import { LEGAL_NOTE_PURPOSE_ERROR } from '@/lib/validation-schemas'

const REQUIRED_SUBMISSION_FIELDS: Array<keyof FormData> = [
  'state',
  'recipient',
  'patientFirstName',
  'patientLastName',
  'patientDateOfBirth',
  'email',
  'phone',
  'notePurpose',
  'firstDayOff',
  'lastDayOff',
  'absenceReason',
]

type PersistedDateFields = {
  patientDateOfBirth: Date | null
  guardianDateOfBirth: Date | null
  firstDayOff: Date | null
  lastDayOff: Date | null
}

export interface PaidSubmissionValidationResult {
  errors: string[]
  canPersistSubmission: boolean
  parsedDates: PersistedDateFields
}

function hasValue(value: FormData[keyof FormData]): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  return value !== undefined && value !== null
}

function pushUnique(errors: string[], message: string) {
  if (!errors.includes(message)) {
    errors.push(message)
  }
}

export function validatePaidSubmissionData(formData: FormData): PaidSubmissionValidationResult {
  const errors: string[] = []
  const hasBlockedNotePurpose = formData.notePurpose === 'legal'

  const parsedDates: PersistedDateFields = {
    patientDateOfBirth: formData.patientDateOfBirth
      ? parseIsoDateOnlyAsUTCDate(formData.patientDateOfBirth)
      : null,
    guardianDateOfBirth: formData.guardianDateOfBirth
      ? parseIsoDateOnlyAsUTCDate(formData.guardianDateOfBirth)
      : null,
    firstDayOff: formData.firstDayOff ? parseIsoDateOnlyAsUTCDate(formData.firstDayOff) : null,
    lastDayOff: formData.lastDayOff ? parseIsoDateOnlyAsUTCDate(formData.lastDayOff) : null,
  }

  const missingFields = REQUIRED_SUBMISSION_FIELDS.filter((field) => !hasValue(formData[field]))
  if (missingFields.length > 0) {
    pushUnique(errors, `Missing required fields: ${missingFields.join(', ')}`)
  }

  if (formData.recipient !== 'myself' && formData.recipient !== 'someone_else') {
    pushUnique(errors, 'Recipient must be either "myself" or "someone_else"')
  }

  if (hasBlockedNotePurpose) {
    pushUnique(errors, LEGAL_NOTE_PURPOSE_ERROR)
  }

  if (formData.recipient === 'someone_else') {
    if (!hasValue(formData.guardianFirstName) || !hasValue(formData.guardianLastName)) {
      pushUnique(errors, 'Guardian information is required when submitting for someone else')
    }
    if (!hasValue(formData.guardianDateOfBirth)) {
      pushUnique(errors, 'Guardian information is required when submitting for someone else')
    }
  }

  if (formData.patientDateOfBirth && !parsedDates.patientDateOfBirth) {
    pushUnique(errors, 'Please enter a valid patient date of birth')
  }
  if (formData.guardianDateOfBirth && !parsedDates.guardianDateOfBirth) {
    pushUnique(errors, 'Please enter a valid guardian date of birth')
  }
  if (formData.firstDayOff && !parsedDates.firstDayOff) {
    pushUnique(errors, 'Please enter a valid first day off')
  }
  if (formData.lastDayOff && !parsedDates.lastDayOff) {
    pushUnique(errors, 'Please enter a valid last day off')
  }

  if (formData.recipient === 'myself' && formData.patientDateOfBirth) {
    if (!isIsoDateOnlyInSaneRange(formData.patientDateOfBirth)) {
      pushUnique(errors, 'Please enter a valid patient date of birth')
    } else if (!isAgeValid(formData.patientDateOfBirth, 18)) {
      pushUnique(errors, 'You must be 18 or older to request a note for yourself')
    }
  }

  if (formData.recipient === 'someone_else') {
    if (formData.guardianDateOfBirth) {
      if (!isIsoDateOnlyInSaneRange(formData.guardianDateOfBirth)) {
        pushUnique(errors, 'Please enter a valid guardian date of birth')
      } else if (!isAgeValid(formData.guardianDateOfBirth, 18)) {
        pushUnique(errors, 'Guardian must be 18 years or older')
      }
    }

    if (formData.patientDateOfBirth && !isIsoDateOnlyInSaneRange(formData.patientDateOfBirth)) {
      pushUnique(errors, 'Please enter a valid patient date of birth')
    }
  }

  if (
    parsedDates.firstDayOff &&
    parsedDates.lastDayOff &&
    formData.firstDayOff &&
    formData.lastDayOff
  ) {
    const dateErrors = validateAbsenceDates({
      firstDayOff: formData.firstDayOff,
      lastDayOff: formData.lastDayOff,
    })
    for (const error of dateErrors) {
      pushUnique(errors, error.message)
    }
  }

  const canPersistSubmission =
    !hasBlockedNotePurpose &&
    missingFields.length === 0 &&
    (formData.recipient === 'myself' || formData.recipient === 'someone_else') &&
    parsedDates.patientDateOfBirth !== null &&
    parsedDates.firstDayOff !== null &&
    parsedDates.lastDayOff !== null &&
    (formData.recipient !== 'someone_else' || parsedDates.guardianDateOfBirth !== null)

  return {
    errors,
    canPersistSubmission,
    parsedDates,
  }
}
