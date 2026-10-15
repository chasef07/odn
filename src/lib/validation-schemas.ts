import { z } from 'zod'
import { isAgeValid } from '@/lib/age-validators'
import { compareDateOnly, getUTCDateOnlyParts, parseIsoDateOnly } from '@/lib/date-only'
import { validateAbsenceDates } from '@/lib/date-validators'
import { ABSENCE_REASONS, AVAILABLE_STATES } from '@/lib/form-constants'
import { formatPhoneNumber, toNationalDigits } from '@/lib/phone-utils'

const NAME_REGEX = /^[\p{L}\p{M}\s'.-]+$/u

function nameField(label: string) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be less than 50 characters`)
    .regex(NAME_REGEX, 'Only letters, spaces, hyphens, apostrophes, and periods are allowed')
}

const dateOfBirthField = z
  .string({ error: 'Date of birth is required' })
  .min(1, 'Date of birth is required')
  .superRefine((val, ctx) => {
    const parsed = parseIsoDateOnly(val)
    if (!parsed) {
      ctx.addIssue({ code: 'custom', message: 'Please enter a valid date of birth' })
      return
    }

    const today = getUTCDateOnlyParts(new Date())
    if (compareDateOnly(parsed, today) > 0) {
      ctx.addIssue({ code: 'custom', message: 'Date of birth cannot be in the future' })
      return
    }

    if (compareDateOnly(parsed, { year: 1900, month: 1, day: 1 }) < 0) {
      ctx.addIssue({ code: 'custom', message: 'Please enter a valid date of birth' })
    }
  })

const RECIPIENTS = ['myself', 'someone_else'] as const
const RECIPIENT_REQUIRED = 'Please choose who this note is for'

export const recipientSchema = z
  .object({
    recipient: z.enum(RECIPIENTS, { error: RECIPIENT_REQUIRED }).nullable(),
  })
  .refine((data) => data.recipient !== null, { message: RECIPIENT_REQUIRED, path: ['recipient'] })

export const patientSchema = z
  .object({
    recipient: z.enum(RECIPIENTS, { error: RECIPIENT_REQUIRED }).nullish(),
    patientFirstName: nameField('First name'),
    patientLastName: nameField('Last name'),
    patientDateOfBirth: dateOfBirthField,
  })
  .superRefine((data, ctx) => {
    if (data.recipient === 'myself' && !isAgeValid(data.patientDateOfBirth, 18)) {
      ctx.addIssue({
        code: 'custom',
        path: ['patientDateOfBirth'],
        message: 'You must be 18 or older to request a note for yourself',
      })
    }
  })

export const guardianSchema = z.object({
  guardianFirstName: nameField('Guardian first name'),
  guardianLastName: nameField('Guardian last name'),
  guardianDateOfBirth: dateOfBirthField.refine((val) => isAgeValid(val, 18), {
    message: 'Guardian must be 18 years or older',
  }),
})

const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  'gnail.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'glail.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'icould.com': 'icloud.com',
  'yhoo.com': 'yahoo.com',
}

const COMMON_TLD_TYPOS: Record<string, string> = {
  '.con': '.com',
  '.cmo': '.com',
  '.om': '.com',
  '.comm': '.com',
  '.nte': '.net',
  '.nrt': '.net',
  '.rog': '.org',
  '.ogv': '.gov',
  '.giv': '.gov',
  '.gvo': '.gov',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.\p{L}{2,}$/u

export const contactSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .toLowerCase()
    .superRefine((email, ctx) => {
      const atIndex = email.indexOf('@')
      const domain = email.slice(atIndex + 1)
      const domainSuggestion = COMMON_DOMAIN_TYPOS[domain]
      if (domainSuggestion) {
        const suggestedEmail = email.slice(0, atIndex + 1) + domainSuggestion
        ctx.addIssue({
          code: 'custom',
          message: `Did you mean "${suggestedEmail}"? Please check your email address.`,
        })
        return
      }

      const tld = email.slice(email.lastIndexOf('.'))
      const tldSuggestion = COMMON_TLD_TYPOS[tld]
      if (tldSuggestion) {
        ctx.addIssue({
          code: 'custom',
          message: `Did you mean "${email.slice(0, -tld.length)}${tldSuggestion}"? Please check your email address.`,
        })
        return
      }

      if (!EMAIL_REGEX.test(email)) {
        ctx.addIssue({ code: 'custom', message: 'Please enter a valid email address' })
      }
    }),
  phone: z
    .string({ error: 'Phone number is required' })
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^\+?[\d\s().-]+$/, 'Please enter a valid phone number')
    .refine((val) => toNationalDigits(val).length === 10, 'Phone number must be exactly 10 digits')
    .transform(formatPhoneNumber),
})

const SUPPORTED_STATES = new Set<string>(AVAILABLE_STATES)

export const stateSchema = z.object({
  state: z
    .string({ error: 'Please select your state' })
    .min(1, 'Please select your state')
    .refine((val) => SUPPORTED_STATES.has(val), 'Please select a state from the list'),
})

export const LEGAL_NOTE_PURPOSE_ERROR =
  'Thank you for your interest in our services. Unfortunately, our notes cannot be used for legal matters, including jury duty, court, probation, or similar obligations. We apologize for any inconvenience.'

const NOTE_PURPOSE_REQUIRED = 'Please select the purpose of this note'

export const notePurposeSchema = z
  .object({
    notePurpose: z
      .enum(['work', 'school', 'both', 'travel', 'legal', 'other'], {
        error: NOTE_PURPOSE_REQUIRED,
      })
      .nullable(),
    otherNotePurpose: z
      .string({ error: 'Please specify the purpose' })
      .max(500, 'Purpose description must be less than 500 characters')
      .optional(),
  })
  .refine((data) => data.notePurpose !== null, {
    message: NOTE_PURPOSE_REQUIRED,
    path: ['notePurpose'],
  })
  .refine((data) => data.notePurpose !== 'legal', {
    message: LEGAL_NOTE_PURPOSE_ERROR,
    path: ['notePurpose'],
  })
  .refine((data) => data.notePurpose !== 'other' || !!data.otherNotePurpose?.trim(), {
    message: 'Please specify the purpose',
    path: ['otherNotePurpose'],
  })

export const absenceDatesSchema = z
  .object({
    firstDayOff: z.string({ error: 'Please select start date' }).min(1, 'Please select start date'),
    lastDayOff: z.string({ error: 'Please select end date' }).min(1, 'Please select end date'),
  })
  .superRefine((data, ctx) => {
    const first = parseIsoDateOnly(data.firstDayOff)
    const last = parseIsoDateOnly(data.lastDayOff)
    if (!first) {
      ctx.addIssue({
        code: 'custom',
        path: ['firstDayOff'],
        message: 'Please enter a valid first day off',
      })
    }
    if (!last) {
      ctx.addIssue({
        code: 'custom',
        path: ['lastDayOff'],
        message: 'Please enter a valid last day off',
      })
    }
    if (!first || !last) return
    for (const error of validateAbsenceDates(data)) {
      ctx.addIssue({ code: 'custom', path: [error.field], message: error.message })
    }
  })

const ABSENCE_REASON_SET = new Set<string>(ABSENCE_REASONS)
const ABSENCE_REASON_REQUIRED = 'Please select a reason for your absence'

export const absenceReasonSchema = z
  .object({
    absenceReason: z.string({ error: ABSENCE_REASON_REQUIRED }).nullable(),
    otherAbsenceReason: z
      .string({ error: 'Please specify the reason' })
      .max(200, 'Reason must be less than 200 characters')
      .optional(),
  })
  .refine((data) => data.absenceReason !== null && ABSENCE_REASON_SET.has(data.absenceReason), {
    message: ABSENCE_REASON_REQUIRED,
    path: ['absenceReason'],
  })
  .refine((data) => data.absenceReason !== 'Other' || !!data.otherAbsenceReason?.trim(), {
    message: 'Please specify the reason',
    path: ['otherAbsenceReason'],
  })

const SYMPTOMS_REQUIRED = 'Please select at least one option'
const OTHER_SYMPTOM_REQUIRED = 'Please describe your other symptoms'

export const symptomsSchema = z
  .object({
    symptoms: z
      .array(z.string({ error: SYMPTOMS_REQUIRED }), { error: SYMPTOMS_REQUIRED })
      .optional(),
    otherSymptomText: z
      .string({ error: OTHER_SYMPTOM_REQUIRED })
      .max(500, 'Symptom description must be less than 500 characters')
      .optional(),
  })
  .refine((data) => (data.symptoms?.length ?? 0) > 0, {
    message: SYMPTOMS_REQUIRED,
    path: ['symptoms'],
  })
  .refine((data) => !data.symptoms?.includes('Other') || !!data.otherSymptomText?.trim(), {
    message: OTHER_SYMPTOM_REQUIRED,
    path: ['otherSymptomText'],
  })

export const additionalInfoSchema = z.object({
  additionalInformation: z
    .string({ error: 'Additional information must be text' })
    .max(1000, 'Additional information must be less than 1000 characters')
    .optional()
    .transform((val) => val?.trim()),
})

const CERTIFY_REQUIRED = 'You must certify that the information is accurate'
const TERMS_REQUIRED = 'You must agree to the Terms of Service and Privacy Policy'

export const termsSchema = z.object({
  certifyAccurate: z
    .boolean({ error: CERTIFY_REQUIRED })
    .refine((val) => val === true, { message: CERTIFY_REQUIRED }),
  agreeTerms: z
    .boolean({ error: TERMS_REQUIRED })
    .refine((val) => val === true, { message: TERMS_REQUIRED }),
  smsOptIn: z.boolean({ error: 'SMS consent must be yes or no' }).optional().default(false),
})

export type IntakeFields = z.input<typeof stateSchema> &
  z.input<typeof recipientSchema> &
  z.input<typeof patientSchema> &
  z.input<typeof guardianSchema> &
  z.input<typeof contactSchema> &
  z.input<typeof notePurposeSchema> &
  z.input<typeof absenceDatesSchema> &
  z.input<typeof absenceReasonSchema> &
  z.input<typeof symptomsSchema> &
  z.input<typeof additionalInfoSchema> &
  z.input<typeof termsSchema>
