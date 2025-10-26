/**
 * Validation Schemas
 * Zod schemas for form validation
 */

import { z } from 'zod';

export const page1Schema = z
  .object({
    recipient: z.enum(['myself', 'someone_else']).nullable(),
    relationship: z.string().optional(),
  })
  .refine(
    (data) => data.recipient !== null,
    {
      message: 'Please choose who this note is for',
      path: ['recipient'],
    }
  )
  .refine(
    (data) => {
      if (data.recipient === 'someone_else') {
        return !!data.relationship;
      }
      return true;
    },
    {
      message: 'Please select your relationship',
      path: ['relationship'],
    }
  );

export const page2Schema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
});

export const page3Schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(
      /^[\d\s\-\(\)]+$/,
      'Please enter a valid phone number'
    ),
});

export const page4Schema = z.object({
  state: z.string().min(1, 'Please select your state'),
});

export const page5Schema = z
  .object({
    notePurpose: z.enum(['work', 'school', 'both', 'other']).nullable(),
  })
  .refine(
    (data) => data.notePurpose !== null,
    {
      message: 'Please select the purpose of this note',
      path: ['notePurpose'],
    }
  );

export const page6Schema = z.object({
  firstDayOff: z.string().min(1, 'Please select start date'),
  lastDayOff: z.string().min(1, 'Please select end date'),
});

export const page7Schema = z
  .object({
    absenceReason: z.string().nullable(),
  })
  .refine(
    (data) => data.absenceReason !== null && data.absenceReason.trim().length > 0,
    {
      message: 'Please select a reason for your absence',
      path: ['absenceReason'],
    }
  );

export const page8Schema = z
  .object({
    symptoms: z.array(z.string()).optional().default([]),
    otherSymptomText: z.string().optional(),
  })
  .refine(
    (data) => {
      // Either symptoms array has items OR otherSymptomText is provided
      const hasSymptoms = data.symptoms && data.symptoms.length > 0;
      const hasOtherText = !!data.otherSymptomText?.trim();
      return hasSymptoms || hasOtherText;
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
        return !!data.otherSymptomText?.trim();
      }
      return true;
    },
    {
      message: 'Please describe your other symptoms',
      path: ['otherSymptomText'],
    }
  );

export const page9Schema = z.object({
  certifyAccurate: z.boolean().refine((val) => val === true, {
    message: 'You must certify that the information is accurate'
  }),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the Terms of Service and Privacy Policy'
  }),
});
