import { describe, it, expect } from 'vitest'
import {
  page1Schema,
  page2Schema,
  guardianSchema,
  page3Schema,
  page4Schema,
  page5Schema,
  page6Schema,
  page7Schema,
  page8Schema,
  page9Schema,
  page10Schema,
  LEGAL_NOTE_PURPOSE_ERROR,
} from '../validation-schemas'

describe('Validation Schemas', () => {
  describe('page1Schema - Recipient Selection', () => {
    it('should accept "myself" as recipient', () => {
      const result = page1Schema.safeParse({ recipient: 'myself' })
      expect(result.success).toBe(true)
    })

    it('should accept "someone_else" as recipient', () => {
      const result = page1Schema.safeParse({ recipient: 'someone_else' })
      expect(result.success).toBe(true)
    })

    it('should reject null recipient', () => {
      const result = page1Schema.safeParse({ recipient: null })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please choose who this note is for')
      }
    })

    it('should reject missing recipient', () => {
      const result = page1Schema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject invalid recipient value', () => {
      const result = page1Schema.safeParse({ recipient: 'invalid' })
      expect(result.success).toBe(false)
    })
  })

  describe('page2Schema - Patient Information', () => {
    const validData = {
      patientFirstName: 'John',
      patientLastName: 'Doe',
      patientDateOfBirth: '1990-01-15',
    }

    it('should accept valid patient data', () => {
      const result = page2Schema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    describe('First Name validation', () => {
      it('should reject empty first name', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('required')
        }
      })

      it('should reject first name with only spaces', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: '   ' })
        expect(result.success).toBe(false)
      })

      it('should accept first name with hyphen', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: 'Mary-Jane' })
        expect(result.success).toBe(true)
      })

      it('should accept first name with apostrophe', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: "O'Brien" })
        expect(result.success).toBe(true)
      })

      it('should accept first name with spaces', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: 'Mary Ann' })
        expect(result.success).toBe(true)
      })

      it('should reject first name over 50 characters', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: 'a'.repeat(51) })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('50 characters')
        }
      })

      it('should reject first name with numbers', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: 'John123' })
        expect(result.success).toBe(false)
      })

      it('should reject first name with special characters', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: 'John@Doe' })
        expect(result.success).toBe(false)
      })

      it('should trim whitespace from first name', () => {
        const result = page2Schema.safeParse({ ...validData, patientFirstName: '  John  ' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.patientFirstName).toBe('John')
        }
      })
    })

    describe('Last Name validation', () => {
      it('should reject empty last name', () => {
        const result = page2Schema.safeParse({ ...validData, patientLastName: '' })
        expect(result.success).toBe(false)
      })

      it('should accept last name with hyphen', () => {
        const result = page2Schema.safeParse({ ...validData, patientLastName: 'Smith-Jones' })
        expect(result.success).toBe(true)
      })

      it('should reject last name over 50 characters', () => {
        const result = page2Schema.safeParse({ ...validData, patientLastName: 'a'.repeat(51) })
        expect(result.success).toBe(false)
      })

      it('should trim whitespace from last name', () => {
        const result = page2Schema.safeParse({ ...validData, patientLastName: '  Doe  ' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.patientLastName).toBe('Doe')
        }
      })
    })

    describe('Date of Birth validation', () => {
      it('should reject empty date of birth', () => {
        const result = page2Schema.safeParse({ ...validData, patientDateOfBirth: '' })
        expect(result.success).toBe(false)
      })

      it('should reject future date of birth', () => {
        const futureDate = new Date()
        futureDate.setFullYear(futureDate.getFullYear() + 1)
        const result = page2Schema.safeParse({
          ...validData,
          patientDateOfBirth: futureDate.toISOString().split('T')[0],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('future')
        }
      })

      it('should reject date before 1900', () => {
        const result = page2Schema.safeParse({ ...validData, patientDateOfBirth: '1899-12-31' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('valid date of birth')
        }
      })

      it('should accept date exactly on 1900-01-01', () => {
        const result = page2Schema.safeParse({ ...validData, patientDateOfBirth: '1900-01-01' })
        expect(result.success).toBe(true)
      })

      it('should accept today as date of birth', () => {
        const today = new Date().toISOString().split('T')[0]
        const result = page2Schema.safeParse({ ...validData, patientDateOfBirth: today })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('guardianSchema - Guardian Information', () => {
    const validData = {
      guardianFirstName: 'Jane',
      guardianLastName: 'Doe',
      guardianDateOfBirth: '1980-05-20',
    }

    it('should accept valid guardian data', () => {
      const result = guardianSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject empty guardian first name', () => {
      const result = guardianSchema.safeParse({ ...validData, guardianFirstName: '' })
      expect(result.success).toBe(false)
    })

    it('should accept guardian name with hyphen', () => {
      const result = guardianSchema.safeParse({ ...validData, guardianFirstName: 'Mary-Ann' })
      expect(result.success).toBe(true)
    })

    it('should trim guardian names', () => {
      const result = guardianSchema.safeParse({
        guardianFirstName: '  Jane  ',
        guardianLastName: '  Doe  ',
        guardianDateOfBirth: '1980-05-20',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.guardianFirstName).toBe('Jane')
        expect(result.data.guardianLastName).toBe('Doe')
      }
    })
  })

  describe('page3Schema - Contact Information', () => {
    const validData = {
      email: 'test@example.com',
      phone: '5551234567',
    }

    it('should accept valid contact data', () => {
      const result = page3Schema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    describe('Email validation', () => {
      it('should reject empty email', () => {
        const result = page3Schema.safeParse({ ...validData, email: '' })
        expect(result.success).toBe(false)
      })

      it('should reject invalid email format', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'notanemail' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('valid email')
        }
      })

      it('should convert email to lowercase', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'TEST@EXAMPLE.COM' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.email).toBe('test@example.com')
        }
      })

      it('should trim whitespace from email', () => {
        const result = page3Schema.safeParse({ ...validData, email: '  test@example.com  ' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.email).toBe('test@example.com')
        }
      })

      it('should accept email with plus sign', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'test+tag@example.com' })
        expect(result.success).toBe(true)
      })

      it('should accept email with subdomain', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'test@mail.example.com' })
        expect(result.success).toBe(true)
      })

      // TLD typo detection tests
      it('should reject .con typo and suggest .com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'test@example.con' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('test@example.com')
          expect(result.error.issues[0].message).toContain('Did you mean')
        }
      })

      it('should reject .cmo typo and suggest .com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'user@gmail.cmo' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('user@gmail.com')
        }
      })

      it('should reject .om typo and suggest .com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'hello@test.om' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('hello@test.com')
        }
      })

      it('should reject .nte typo and suggest .net', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'user@example.nte' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('user@example.net')
        }
      })

      it('should reject .rog typo and suggest .org', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'contact@nonprofit.rog' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('contact@nonprofit.org')
        }
      })

      // Domain typo detection tests
      it('should reject gnail.com and suggest gmail.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'test@gnail.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('test@gmail.com')
          expect(result.error.issues[0].message).toContain('Did you mean')
        }
      })

      it('should reject gmai.com and suggest gmail.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'user@gmai.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('user@gmail.com')
        }
      })

      it('should reject gmial.com and suggest gmail.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'hello@gmial.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('hello@gmail.com')
        }
      })

      it('should reject gamil.com and suggest gmail.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'contact@gamil.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('contact@gmail.com')
        }
      })

      it('should reject glail.com and suggest gmail.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'user@glail.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('user@gmail.com')
        }
      })

      it('should reject gmal.com and suggest gmail.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'test@gmal.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('test@gmail.com')
        }
      })

      it('should reject icould.com and suggest icloud.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'user@icould.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('user@icloud.com')
        }
      })

      it('should reject ymail.com and suggest gmail.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'contact@ymail.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('contact@gmail.com')
        }
      })

      it('should reject yhoo.com and suggest yahoo.com', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'hello@yhoo.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('hello@yahoo.com')
        }
      })

      it('should accept valid .com email', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'test@example.com' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .net email', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'test@example.net' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .org email', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'test@example.org' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .edu email', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'student@university.edu' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .gov email', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'admin@agency.gov' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .io email', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'dev@startup.io' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .co.uk email', () => {
        const result = page3Schema.safeParse({ ...validData, email: 'info@company.co.uk' })
        expect(result.success).toBe(true)
      })
    })

    describe('Phone validation', () => {
      it('should reject empty phone', () => {
        const result = page3Schema.safeParse({ ...validData, phone: '' })
        expect(result.success).toBe(false)
      })

      it('should accept 10-digit phone number', () => {
        const result = page3Schema.safeParse({ ...validData, phone: '5551234567' })
        expect(result.success).toBe(true)
      })

      it('should accept formatted phone number', () => {
        const result = page3Schema.safeParse({ ...validData, phone: '(555) 123-4567' })
        expect(result.success).toBe(true)
      })

      it('should reject phone with less than 10 digits', () => {
        const result = page3Schema.safeParse({ ...validData, phone: '555123456' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('10 digits')
        }
      })

      it('should reject phone with more than 10 digits', () => {
        const result = page3Schema.safeParse({ ...validData, phone: '55512345678' })
        expect(result.success).toBe(false)
      })

      it('should reject phone with letters', () => {
        const result = page3Schema.safeParse({ ...validData, phone: '555-CALL-NOW' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('valid phone number')
        }
      })

      it('should accept phone with spaces and dashes', () => {
        const result = page3Schema.safeParse({ ...validData, phone: '555 123 4567' })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('page4Schema - State Selection', () => {
    it('should accept valid state', () => {
      const result = page4Schema.safeParse({ state: 'CA' })
      expect(result.success).toBe(true)
    })

    it('should reject empty state', () => {
      const result = page4Schema.safeParse({ state: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('select your state')
      }
    })

    it('should reject missing state', () => {
      const result = page4Schema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('page5Schema - Note Purpose', () => {
    it('should accept "work" as note purpose', () => {
      const result = page5Schema.safeParse({ notePurpose: 'work' })
      expect(result.success).toBe(true)
    })

    it('should accept "school" as note purpose', () => {
      const result = page5Schema.safeParse({ notePurpose: 'school' })
      expect(result.success).toBe(true)
    })

    it('should accept "both" as note purpose', () => {
      const result = page5Schema.safeParse({ notePurpose: 'both' })
      expect(result.success).toBe(true)
    })

    it('should accept "other" with text description', () => {
      const result = page5Schema.safeParse({
        notePurpose: 'other',
        otherNotePurpose: 'Personal reasons',
      })
      expect(result.success).toBe(true)
    })

    it('should reject legal matters as note purpose', () => {
      const result = page5Schema.safeParse({ notePurpose: 'legal' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message === LEGAL_NOTE_PURPOSE_ERROR)
        ).toBe(true)
      }
    })

    it('should reject null note purpose', () => {
      const result = page5Schema.safeParse({ notePurpose: null })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('select the purpose')
      }
    })

    it('should reject "other" without text description', () => {
      const result = page5Schema.safeParse({ notePurpose: 'other' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('specify'))).toBe(true)
      }
    })

    it('should reject "other" with empty text description', () => {
      const result = page5Schema.safeParse({ notePurpose: 'other', otherNotePurpose: '   ' })
      expect(result.success).toBe(false)
    })

    it('should reject other purpose text over 500 characters', () => {
      const result = page5Schema.safeParse({
        notePurpose: 'other',
        otherNotePurpose: 'a'.repeat(501),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500 characters')
      }
    })

    it('should accept "work" without otherNotePurpose', () => {
      const result = page5Schema.safeParse({ notePurpose: 'work' })
      expect(result.success).toBe(true)
    })
  })

  describe('page6Schema - Absence Dates', () => {
    it('should accept valid date range', () => {
      const result = page6Schema.safeParse({
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-20',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty first day off', () => {
      const result = page6Schema.safeParse({
        firstDayOff: '',
        lastDayOff: '2025-01-20',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('start date')
      }
    })

    it('should reject empty last day off', () => {
      const result = page6Schema.safeParse({
        firstDayOff: '2025-01-15',
        lastDayOff: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('end date')
      }
    })
  })

  describe('page7Schema - Absence Reason', () => {
    it('should accept valid absence reason', () => {
      const result = page7Schema.safeParse({ absenceReason: 'Illness' })
      expect(result.success).toBe(true)
    })

    it('should accept "Other" with text description', () => {
      const result = page7Schema.safeParse({
        absenceReason: 'Other',
        otherAbsenceReason: 'Personal emergency',
      })
      expect(result.success).toBe(true)
    })

    it('should reject null absence reason', () => {
      const result = page7Schema.safeParse({ absenceReason: null })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('select a reason')
      }
    })

    it('should reject empty string absence reason', () => {
      const result = page7Schema.safeParse({ absenceReason: '   ' })
      expect(result.success).toBe(false)
    })

    it('should reject "Other" without text description', () => {
      const result = page7Schema.safeParse({ absenceReason: 'Other' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('specify'))).toBe(true)
      }
    })

    it('should reject "Other" with empty text', () => {
      const result = page7Schema.safeParse({ absenceReason: 'Other', otherAbsenceReason: '   ' })
      expect(result.success).toBe(false)
    })

    it('should reject other reason over 200 characters', () => {
      const result = page7Schema.safeParse({
        absenceReason: 'Other',
        otherAbsenceReason: 'a'.repeat(201),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('200 characters')
      }
    })

    it('should accept non-Other reason without otherAbsenceReason', () => {
      const result = page7Schema.safeParse({ absenceReason: 'Illness' })
      expect(result.success).toBe(true)
    })
  })

  describe('page8Schema - Symptoms', () => {
    it('should accept array of symptoms', () => {
      const result = page8Schema.safeParse({ symptoms: ['Fever', 'Cough'] })
      expect(result.success).toBe(true)
    })

    it('should accept "other" symptom with text description', () => {
      const result = page8Schema.safeParse({
        symptoms: ['other'],
        otherSymptomText: 'Custom symptom description',
      })
      expect(result.success).toBe(true)
    })

    it('should accept symptoms without "other"', () => {
      const result = page8Schema.safeParse({ symptoms: ['Fever', 'Headache'] })
      expect(result.success).toBe(true)
    })

    it('should reject empty symptoms and no text', () => {
      const result = page8Schema.safeParse({ symptoms: [] })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least one symptom')
      }
    })

    it('should reject "other" symptom without text description', () => {
      const result = page8Schema.safeParse({ symptoms: ['other'] })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('describe'))).toBe(true)
      }
    })

    it('should reject "other" with empty text', () => {
      const result = page8Schema.safeParse({ symptoms: ['other'], otherSymptomText: '   ' })
      expect(result.success).toBe(false)
    })

    it('should accept only other symptom text without symptoms array', () => {
      const result = page8Schema.safeParse({ otherSymptomText: 'Custom symptoms' })
      expect(result.success).toBe(true)
    })

    it('should reject other symptom text over 500 characters', () => {
      const result = page8Schema.safeParse({
        symptoms: ['other'],
        otherSymptomText: 'a'.repeat(501),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500 characters')
      }
    })

    it('should accept multiple symptoms including "other" with text', () => {
      const result = page8Schema.safeParse({
        symptoms: ['Fever', 'other'],
        otherSymptomText: 'Unusual symptom',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('page9Schema - Additional Information', () => {
    it('should accept empty additional information', () => {
      const result = page9Schema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should accept valid additional information', () => {
      const result = page9Schema.safeParse({ additionalInformation: 'Some extra details' })
      expect(result.success).toBe(true)
    })

    it('should reject additional information over 1000 characters', () => {
      const result = page9Schema.safeParse({ additionalInformation: 'a'.repeat(1001) })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1000 characters')
      }
    })

    it('should accept exactly 1000 characters', () => {
      const result = page9Schema.safeParse({ additionalInformation: 'a'.repeat(1000) })
      expect(result.success).toBe(true)
    })

    it('should trim additional information', () => {
      const result = page9Schema.safeParse({ additionalInformation: '  Some text  ' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.additionalInformation).toBe('Some text')
      }
    })

    it('should transform empty string to undefined', () => {
      const result = page9Schema.safeParse({ additionalInformation: '   ' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.additionalInformation).toBe('')
      }
    })
  })

  describe('page10Schema - Terms and Conditions', () => {
    it('should accept both checkboxes as true', () => {
      const result = page10Schema.safeParse({
        certifyAccurate: true,
        agreeTerms: true,
      })
      expect(result.success).toBe(true)
    })

    it('should reject certifyAccurate as false', () => {
      const result = page10Schema.safeParse({
        certifyAccurate: false,
        agreeTerms: true,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('certify')
      }
    })

    it('should reject agreeTerms as false', () => {
      const result = page10Schema.safeParse({
        certifyAccurate: true,
        agreeTerms: false,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('agree')
      }
    })

    it('should reject both checkboxes as false', () => {
      const result = page10Schema.safeParse({
        certifyAccurate: false,
        agreeTerms: false,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('should reject missing certifyAccurate', () => {
      const result = page10Schema.safeParse({ agreeTerms: true })
      expect(result.success).toBe(false)
    })

    it('should reject missing agreeTerms', () => {
      const result = page10Schema.safeParse({ certifyAccurate: true })
      expect(result.success).toBe(false)
    })
  })
})
