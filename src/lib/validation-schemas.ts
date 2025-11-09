/**
 * Validation Schemas
 * Zod schemas for form validation
 */

import { z } from 'zod'

export const page1Schema = z
  .object({
    recipient: z.enum(['myself', 'someone_else']).nullable(),
  })
  .refine((data) => data.recipient !== null, {
    message: 'Please choose who this note is for',
    path: ['recipient'],
  })

export const page2Schema = z.object({
  patientFirstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes are allowed')
    .refine((val) => val.trim().length > 0, 'First name cannot be only spaces'),
  patientLastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes are allowed')
    .refine((val) => val.trim().length > 0, 'Last name cannot be only spaces'),
  patientDateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((val) => new Date(val) <= new Date(), {
      message: 'Date of birth cannot be in the future',
    })
    .refine((val) => new Date(val) >= new Date('1900-01-01'), {
      message: 'Please enter a valid date of birth',
    }),
})

export const guardianSchema = z.object({
  guardianFirstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes are allowed')
    .refine((val) => val.trim().length > 0, 'First name cannot be only spaces'),
  guardianLastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes are allowed')
    .refine((val) => val.trim().length > 0, 'Last name cannot be only spaces'),
  guardianDateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((val) => new Date(val) <= new Date(), {
      message: 'Date of birth cannot be in the future',
    })
    .refine((val) => new Date(val) >= new Date('1900-01-01'), {
      message: 'Please enter a valid date of birth',
    }),
})

// Common TLD typos and their corrections
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

// Common valid TLDs (not exhaustive, but covers 95%+ of users)
const COMMON_TLDS = [
  '.com', '.net', '.org', '.edu', '.gov', '.mil',
  '.co', '.uk', '.us', '.ca', '.au', '.de', '.fr', '.jp', '.cn', '.in', '.br',
  '.io', '.ai', '.dev', '.app', '.tech', '.info', '.biz', '.me', '.tv',
  '.co.uk', '.com.au', '.co.nz', '.co.za', '.com.br',
]

export const page3Schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .toLowerCase()
    .superRefine((email, ctx) => {
      // Basic email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid email address',
        })
        return
      }

      // Extract TLD from email
      const lastDotIndex = email.lastIndexOf('.')
      if (lastDotIndex === -1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please enter a valid email address',
        })
        return
      }

      const tld = email.slice(lastDotIndex)

      // Check for common TLD typos and provide helpful suggestions
      const suggestion = COMMON_TLD_TYPOS[tld]
      if (suggestion) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Did you mean "${email.replace(tld, suggestion)}"? Please check your email address.`,
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

export const page5Schema = z
  .object({
    notePurpose: z.enum(['work', 'school', 'both', 'other']).nullable(),
    otherNotePurpose: z
      .string()
      .max(500, 'Purpose description must be less than 500 characters')
      .optional(),
  })
  .refine((data) => data.notePurpose !== null, {
    message: 'Please select the purpose of this note',
    path: ['notePurpose'],
  })
  .refine(
    (data) => {
      if (data.notePurpose === 'other') {
        return !!data.otherNotePurpose?.trim() && data.otherNotePurpose.trim().length > 0
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
        return !!data.otherAbsenceReason?.trim() && data.otherAbsenceReason.trim().length > 0
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
      // Either symptoms array has items OR otherSymptomText is provided
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
      // If "other" is selected in symptoms, require otherSymptomText
      if (data.symptoms && data.symptoms.includes('other')) {
        return !!data.otherSymptomText?.trim() && data.otherSymptomText.trim().length > 0
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
})
