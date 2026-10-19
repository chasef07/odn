import { z } from 'zod'
import { isAgeValid } from '@/lib/age-validators'
import { parseDateOnly, todayUTC } from '@/lib/dates'
import { validateAbsenceDates } from '@/lib/date-validators'
import { ABSENCE_REASONS, AVAILABLE_STATES } from '@/lib/form-constants'
import { rule } from '@/lib/intake-rules'
import { DATE_LIMITS } from '@/lib/validation-constants'
import { formatPhoneNumber, toNationalDigits } from '@/lib/phone-utils'

const NAME_REGEX = /^(?=.*\p{L})[\p{L}\p{M} '’‘.-]+$/u

function nameField(label: string) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be less than 50 characters`)
    .refine((val) => NAME_REGEX.test(val), {
      message: 'Only letters, spaces, hyphens, apostrophes, and periods are allowed',
      params: rule('name_characters'),
    })
}

const dateOfBirthField = z
  .string({ error: 'Date of birth is required' })
  .min(1, 'Date of birth is required')
  .superRefine((val, ctx) => {
    const parsed = parseDateOnly(val)
    if (!parsed) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please enter a valid date of birth',
        params: rule('date_invalid'),
      })
      return
    }

    if (parsed > todayUTC()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Date of birth cannot be in the future',
        params: rule('date_future'),
      })
      return
    }

    if (parsed < DATE_LIMITS.EARLIEST_DAY) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please enter a valid date of birth',
        params: rule('date_before_1900'),
      })
    }
  })

const RECIPIENTS = ['myself', 'someone_else'] as const
const RECIPIENT_REQUIRED = 'Please choose who this note is for'

export const recipientSchema = z
  .object({
    recipient: z.enum(RECIPIENTS, { error: RECIPIENT_REQUIRED }).nullable(),
  })
  .refine((data) => data.recipient !== null, {
    message: RECIPIENT_REQUIRED,
    path: ['recipient'],
    params: rule('required'),
  })

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
        params: rule('under_18'),
      })
    }
  })

export const guardianSchema = z.object({
  guardianFirstName: nameField('Guardian first name'),
  guardianLastName: nameField('Guardian last name'),
  guardianDateOfBirth: dateOfBirthField.refine((val) => isAgeValid(val, 18), {
    message: 'Guardian must be 18 years or older',
    params: rule('under_18'),
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
  '.comm': '.com',
  '.nte': '.net',
  '.nrt': '.net',
  '.rog': '.org',
  '.ogv': '.gov',
  '.giv': '.gov',
  '.gvo': '.gov',
}

const EMAIL_REGEX = /^[^\s@]+@(?:[^\s@.]+\.)+\p{L}{2,}$/u
const PHONE_REGEX = /^\+?[\d\s().-]+$/

export const contactSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .toLowerCase()
    .superRefine((email, ctx) => {
      if (!EMAIL_REGEX.test(email)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please enter a valid email address',
          params: rule('email_invalid'),
        })
        return
      }

      const domain = email.slice(email.indexOf('@') + 1)
      const tld = email.slice(email.lastIndexOf('.'))
      const suggestion = COMMON_DOMAIN_TYPOS[domain] ?? COMMON_TLD_TYPOS[tld]
      if (suggestion) {
        ctx.addIssue({
          code: 'custom',
          message: `Did you mean "${suggestion}"? Please check your email address.`,
          params: rule('email_typo'),
        })
      }
    }),
  phone: z
    .string({ error: 'Phone number is required' })
    .trim()
    .min(1, 'Phone number is required')
    .refine((val) => PHONE_REGEX.test(val), {
      message: 'Please enter a valid phone number',
      params: rule('phone_characters'),
    })
    .refine((val) => toNationalDigits(val).length === 10, {
      message: 'Phone number must be exactly 10 digits',
      params: rule('phone_digits'),
    })
    .transform(formatPhoneNumber),
})

const SUPPORTED_STATES = new Set<string>(AVAILABLE_STATES)

export const stateSchema = z.object({
  state: z
    .string({ error: 'Please select your state' })
    .trim()
    .min(1, 'Please select your state')
    .refine((val) => SUPPORTED_STATES.has(val), {
      message: 'Please select a state from the list',
      params: rule('state_unsupported'),
    }),
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
      .nullish(),
  })
  .refine((data) => data.notePurpose !== null, {
    message: NOTE_PURPOSE_REQUIRED,
    path: ['notePurpose'],
    params: rule('required'),
  })
  .refine((data) => data.notePurpose !== 'legal', {
    message: LEGAL_NOTE_PURPOSE_ERROR,
    path: ['notePurpose'],
    params: rule('purpose_legal'),
  })
  .refine((data) => data.notePurpose !== 'other' || !!data.otherNotePurpose?.trim(), {
    message: 'Please specify the purpose',
    path: ['otherNotePurpose'],
    params: rule('purpose_other_text'),
  })

export const absenceDatesSchema = z
  .object({
    firstDayOff: z.string({ error: 'Please select start date' }).min(1, 'Please select start date'),
    lastDayOff: z.string({ error: 'Please select end date' }).min(1, 'Please select end date'),
  })
  .superRefine((data, ctx) => {
    const first = parseDateOnly(data.firstDayOff)
    const last = parseDateOnly(data.lastDayOff)
    if (!first) {
      ctx.addIssue({
        code: 'custom',
        path: ['firstDayOff'],
        message: 'Please enter a valid first day off',
        params: rule('date_invalid'),
      })
    }
    if (!last) {
      ctx.addIssue({
        code: 'custom',
        path: ['lastDayOff'],
        message: 'Please enter a valid last day off',
        params: rule('date_invalid'),
      })
    }
    if (!first || !last) return
    for (const error of validateAbsenceDates(data)) {
      ctx.addIssue({
        code: 'custom',
        path: [error.field],
        message: error.message,
        params: rule(error.rule),
      })
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
      .nullish(),
  })
  .refine((data) => data.absenceReason !== null && ABSENCE_REASON_SET.has(data.absenceReason), {
    message: ABSENCE_REASON_REQUIRED,
    path: ['absenceReason'],
    params: rule('unknown_option'),
  })
  .refine((data) => data.absenceReason !== 'Other' || !!data.otherAbsenceReason?.trim(), {
    message: 'Please specify the reason',
    path: ['otherAbsenceReason'],
    params: rule('reason_other_text'),
  })

const SYMPTOMS_REQUIRED = 'Please select at least one option'
const OTHER_SYMPTOM_REQUIRED = 'Please describe your other symptoms'

export const symptomsSchema = z
  .object({
    symptoms: z
      .array(z.string({ error: SYMPTOMS_REQUIRED }), { error: SYMPTOMS_REQUIRED })
      .nullish(),
    otherSymptomText: z
      .string({ error: OTHER_SYMPTOM_REQUIRED })
      .max(500, 'Symptom description must be less than 500 characters')
      .nullish(),
  })
  .refine((data) => (data.symptoms?.length ?? 0) > 0, {
    message: SYMPTOMS_REQUIRED,
    path: ['symptoms'],
    params: rule('symptoms_none'),
  })
  .refine((data) => !data.symptoms?.includes('Other') || !!data.otherSymptomText?.trim(), {
    message: OTHER_SYMPTOM_REQUIRED,
    path: ['otherSymptomText'],
    params: rule('symptom_other_text'),
  })

export const additionalInfoSchema = z.object({
  additionalInformation: z
    .string({ error: 'Additional information must be text' })
    .max(1000, 'Additional information must be less than 1000 characters')
    .nullish()
    .transform((val) => val?.trim()),
})

const CERTIFY_REQUIRED = 'You must certify that the information is accurate'
const TERMS_REQUIRED = 'You must agree to the Terms of Service and Privacy Policy'

export const termsSchema = z.object({
  certifyAccurate: z
    .boolean({ error: CERTIFY_REQUIRED })
    .refine((val) => val === true, { message: CERTIFY_REQUIRED, params: rule('required') }),
  agreeTerms: z
    .boolean({ error: TERMS_REQUIRED })
    .refine((val) => val === true, { message: TERMS_REQUIRED, params: rule('required') }),
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
