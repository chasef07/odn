import { z } from 'zod'
import { isAgeValid } from '@/lib/age-validators'
import { compareDateOnly, getUTCDateOnlyParts, parseIsoDateOnly } from '@/lib/date-only'

const NAME_REGEX = /^[a-zA-Z\s'-]+$/

function nameField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be less than 50 characters`)
    .regex(NAME_REGEX, 'Only letters, spaces, hyphens, and apostrophes are allowed')
    .refine((val) => val.trim().length > 0, `${label} cannot be only spaces`)
}

const dateOfBirthField = z
  .string()
  .min(1, 'Date of birth is required')
  .superRefine((val, ctx) => {
    const parsed = parseIsoDateOnly(val)
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please enter a valid date of birth',
      })
      return
    }

    const today = getUTCDateOnlyParts(new Date())
    if (compareDateOnly(parsed, today) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date of birth cannot be in the future',
      })
      return
    }

    if (compareDateOnly(parsed, { year: 1900, month: 1, day: 1 }) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please enter a valid date of birth',
      })
    }
  })

export const page1Schema = z
  .object({
    recipient: z.enum(['myself', 'someone_else']).nullable(),
  })
  .refine((data) => data.recipient !== null, {
    message: 'Please choose who this note is for',
    path: ['recipient'],
  })

export const page2Schema = z.object({
  patientFirstName: nameField('First name'),
  patientLastName: nameField('Last name'),
  patientDateOfBirth: dateOfBirthField,
})

export const guardianSchema = z.object({
  guardianFirstName: nameField('First name'),
  guardianLastName: nameField('Last name'),
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
  'ymail.com': 'gmail.com',
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

const COMMON_TLDS = [
  '.com',
  '.net',
  '.org',
  '.edu',
  '.gov',
  '.mil',
  '.co',
  '.uk',
  '.us',
  '.ca',
  '.au',
  '.de',
  '.fr',
  '.jp',
  '.cn',
  '.in',
  '.br',
  '.io',
  '.ai',
  '.dev',
  '.app',
  '.tech',
  '.info',
  '.biz',
  '.me',
  '.tv',
  '.co.uk',
  '.com.au',
  '.co.nz',
  '.co.za',
  '.com.br',
]

export const page3Schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .toLowerCase()
    .superRefine((email, ctx) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid email address',
        })
        return
      }

      const atIndex = email.indexOf('@')
      const domain = email.slice(atIndex + 1)

      const domainSuggestion = COMMON_DOMAIN_TYPOS[domain]
      if (domainSuggestion) {
        const suggestedEmail = email.slice(0, atIndex + 1) + domainSuggestion
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Did you mean "${suggestedEmail}"? Please check your email address.`,
        })
        return
      }

      const lastDotIndex = email.lastIndexOf('.')
      if (lastDotIndex === -1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid email address',
        })
        return
      }

      const tld = email.slice(lastDotIndex)

      const suggestion = COMMON_TLD_TYPOS[tld]
      if (suggestion) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Did you mean "${email.replace(tld, suggestion)}"? Please check your email address.`,
        })
        return
      }

      const isValidTLD = COMMON_TLDS.some(
        (validTld) => tld === validTld || email.endsWith(validTld)
      )
      if (!isValidTLD) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid email address with a recognized domain',
        })
        return
      }
    }),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^[\d\s\-\(\)]+$/, 'Please enter a valid phone number')
    .refine(
      (val) => {
        const digitsOnly = val.replace(/\D/g, '')
        return digitsOnly.length === 10
      },
      {
        message: 'Phone number must be exactly 10 digits',
      }
    ),
})

export const page4Schema = z.object({
  state: z.string().min(1, 'Please select your state'),
})

export const LEGAL_NOTE_PURPOSE_ERROR =
  'Thank you for your interest in our services. Unfortunately, our notes cannot be used for legal matters, including jury duty, court, probation, or similar obligations. We apologize for any inconvenience.'

export const page5Schema = z
  .object({
    notePurpose: z.enum(['work', 'school', 'both', 'travel', 'legal', 'other']).nullable(),
    otherNotePurpose: z
      .string()
      .max(500, 'Purpose description must be less than 500 characters')
      .optional(),
  })
  .refine((data) => data.notePurpose !== null, {
    message: 'Please select the purpose of this note',
    path: ['notePurpose'],
  })
  .refine((data) => data.notePurpose !== 'legal', {
    message: LEGAL_NOTE_PURPOSE_ERROR,
    path: ['notePurpose'],
  })
  .refine(
    (data) => {
      if (data.notePurpose === 'other') {
        return !!data.otherNotePurpose?.trim()
      }
      return true
    },
    {
      message: 'Please specify the purpose',
      path: ['otherNotePurpose'],
    }
  )

export const page6Schema = z.object({
  firstDayOff: z.string().min(1, 'Please select start date'),
  lastDayOff: z.string().min(1, 'Please select end date'),
})

export const page7Schema = z
  .object({
    absenceReason: z.string().nullable(),
    otherAbsenceReason: z.string().max(200, 'Reason must be less than 200 characters').optional(),
  })
  .refine((data) => data.absenceReason !== null && data.absenceReason.trim().length > 0, {
    message: 'Please select a reason for your absence',
    path: ['absenceReason'],
  })
  .refine(
    (data) => {
      if (data.absenceReason === 'Other') {
        return !!data.otherAbsenceReason?.trim()
      }
      return true
    },
    {
      message: 'Please specify the reason',
      path: ['otherAbsenceReason'],
    }
  )

export const page8Schema = z
  .object({
    symptoms: z.array(z.string()).optional(),
    otherSymptomText: z
      .string()
      .max(500, 'Symptom description must be less than 500 characters')
      .optional(),
  })
  .refine(
    (data) => {
      const hasSymptoms = data.symptoms && data.symptoms.length > 0
      const hasOtherText = !!data.otherSymptomText?.trim()
      return hasSymptoms || hasOtherText
    },
    {
      message: 'Please select at least one symptom or describe your symptoms',
      path: ['symptoms'],
    }
  )
  .refine(
    (data) => {
      if (data.symptoms && data.symptoms.includes('other')) {
        return !!data.otherSymptomText?.trim()
      }
      return true
    },
    {
      message: 'Please describe your other symptoms',
      path: ['otherSymptomText'],
    }
  )

export const page9Schema = z.object({
  additionalInformation: z
    .string()
    .max(1000, 'Additional information must be less than 1000 characters')
    .optional()
    .transform((val) => val?.trim()),
})

export const page10Schema = z.object({
  certifyAccurate: z.boolean().refine((val) => val === true, {
    message: 'You must certify that the information is accurate',
  }),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the Terms of Service and Privacy Policy',
  }),
  smsOptIn: z.boolean().optional().default(false),
})
