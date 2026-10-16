import { describe, it, expect } from 'vitest'
import {
  recipientSchema,
  patientSchema,
  guardianSchema,
  contactSchema,
  stateSchema,
  notePurposeSchema,
  absenceDatesSchema,
  absenceReasonSchema,
  symptomsSchema,
  additionalInfoSchema,
  termsSchema,
  LEGAL_NOTE_PURPOSE_ERROR,
} from '../validation-schemas'

describe('Validation Schemas', () => {
  describe('recipientSchema - Recipient Selection', () => {
    it('should accept "myself" as recipient', () => {
      const result = recipientSchema.safeParse({ recipient: 'myself' })
      expect(result.success).toBe(true)
    })

    it('should accept "someone_else" as recipient', () => {
      const result = recipientSchema.safeParse({ recipient: 'someone_else' })
      expect(result.success).toBe(true)
    })

    it('should reject null recipient', () => {
      const result = recipientSchema.safeParse({ recipient: null })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please choose who this note is for')
      }
    })

    it('should reject missing recipient', () => {
      const result = recipientSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject invalid recipient value', () => {
      const result = recipientSchema.safeParse({ recipient: 'invalid' })
      expect(result.success).toBe(false)
    })
  })

  describe('patientSchema - Patient Information', () => {
    const validData = {
      patientFirstName: 'John',
      patientLastName: 'Doe',
      patientDateOfBirth: '1990-01-15',
    }

    it('should accept valid patient data', () => {
      const result = patientSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    describe('First Name validation', () => {
      it('should reject empty first name', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('required')
        }
      })

      it('should reject first name with only spaces', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: '   ' })
        expect(result.success).toBe(false)
      })

      it('should accept first name with hyphen', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: 'Mary-Jane' })
        expect(result.success).toBe(true)
      })

      it('should accept first name with apostrophe', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: "O'Brien" })
        expect(result.success).toBe(true)
      })

      it('should accept first name with spaces', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: 'Mary Ann' })
        expect(result.success).toBe(true)
      })

      it('should reject first name over 50 characters', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: 'a'.repeat(51) })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('50 characters')
        }
      })

      it('should reject first name with numbers', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: 'John123' })
        expect(result.success).toBe(false)
      })

      it('should reject first name with special characters', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: 'John@Doe' })
        expect(result.success).toBe(false)
      })

      it('should accept accented, non-Latin, and suffixed names', () => {
        for (const name of ['José', 'Muñoz', 'Nguyễn', '李', 'Smith Jr.', "O'Brien-Smith"]) {
          expect(patientSchema.safeParse({ ...validData, patientFirstName: name }).success).toBe(
            true
          )
        }
      })

      it('should reject an under-18 patient only when the note is for myself', () => {
        const minor = new Date()
        minor.setUTCFullYear(minor.getUTCFullYear() - 10)
        const patientDateOfBirth = minor.toISOString().split('T')[0]
        const asMyself = patientSchema.safeParse({
          ...validData,
          recipient: 'myself',
          patientDateOfBirth,
        })
        expect(asMyself.success).toBe(false)
        if (!asMyself.success) {
          expect(asMyself.error.issues[0].message).toBe(
            'You must be 18 or older to request a note for yourself'
          )
        }
        expect(
          patientSchema.safeParse({ ...validData, recipient: 'someone_else', patientDateOfBirth })
            .success
        ).toBe(true)
      })

      it('should trim whitespace from first name', () => {
        const result = patientSchema.safeParse({ ...validData, patientFirstName: '  John  ' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.patientFirstName).toBe('John')
        }
      })
    })

    describe('Last Name validation', () => {
      it('should reject empty last name', () => {
        const result = patientSchema.safeParse({ ...validData, patientLastName: '' })
        expect(result.success).toBe(false)
      })

      it('should accept last name with hyphen', () => {
        const result = patientSchema.safeParse({ ...validData, patientLastName: 'Smith-Jones' })
        expect(result.success).toBe(true)
      })

      it('should reject last name over 50 characters', () => {
        const result = patientSchema.safeParse({ ...validData, patientLastName: 'a'.repeat(51) })
        expect(result.success).toBe(false)
      })

      it('should trim whitespace from last name', () => {
        const result = patientSchema.safeParse({ ...validData, patientLastName: '  Doe  ' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.patientLastName).toBe('Doe')
        }
      })
    })

    describe('Date of Birth validation', () => {
      it('should reject empty date of birth', () => {
        const result = patientSchema.safeParse({ ...validData, patientDateOfBirth: '' })
        expect(result.success).toBe(false)
      })

      it('should reject future date of birth', () => {
        const futureDate = new Date()
        futureDate.setFullYear(futureDate.getFullYear() + 1)
        const result = patientSchema.safeParse({
          ...validData,
          patientDateOfBirth: futureDate.toISOString().split('T')[0],
        })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('future')
        }
      })

      it('should reject date before 1900', () => {
        const result = patientSchema.safeParse({ ...validData, patientDateOfBirth: '1899-12-31' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('valid date of birth')
        }
      })

      it('should accept date exactly on 1900-01-01', () => {
        const result = patientSchema.safeParse({ ...validData, patientDateOfBirth: '1900-01-01' })
        expect(result.success).toBe(true)
      })

      it('should accept today as date of birth', () => {
        const today = new Date().toISOString().split('T')[0]
        const result = patientSchema.safeParse({ ...validData, patientDateOfBirth: today })
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

  describe('contactSchema - Contact Information', () => {
    const validData = {
      email: 'test@example.com',
      phone: '5551234567',
    }

    it('should accept valid contact data', () => {
      const result = contactSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    describe('Email validation', () => {
      it('should reject empty email', () => {
        const result = contactSchema.safeParse({ ...validData, email: '' })
        expect(result.success).toBe(false)
      })

      it('should reject invalid email format', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'notanemail' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('valid email')
        }
      })

      it('should convert email to lowercase', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'TEST@EXAMPLE.COM' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.email).toBe('test@example.com')
        }
      })

      it('should trim whitespace from email', () => {
        const result = contactSchema.safeParse({ ...validData, email: '  test@example.com  ' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.email).toBe('test@example.com')
        }
      })

      it('should accept email with plus sign', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'test+tag@example.com' })
        expect(result.success).toBe(true)
      })

      it('should accept email with subdomain', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'test@mail.example.com' })
        expect(result.success).toBe(true)
      })

      it('should reject .con typo and suggest .com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'test@example.con' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('".com"')
          expect(result.error.issues[0].message).toContain('Did you mean')
        }
      })

      it('should reject .cmo typo and suggest .com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'user@gmail.cmo' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('".com"')
        }
      })

      it('should accept .om, which is a real top-level domain', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'hello@test.om' })
        expect(result.success).toBe(true)
      })

      it('should reject .nte typo and suggest .net', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'user@example.nte' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('".net"')
        }
      })

      it('should reject .rog typo and suggest .org', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'contact@nonprofit.rog' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('".org"')
        }
      })

      it('should reject gnail.com and suggest gmail.com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'test@gnail.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('"gmail.com"')
          expect(result.error.issues[0].message).toContain('Did you mean')
        }
      })

      it('should reject gmai.com and suggest gmail.com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'user@gmai.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('"gmail.com"')
        }
      })

      it('should reject gmial.com and suggest gmail.com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'hello@gmial.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('"gmail.com"')
        }
      })

      it('should reject gamil.com and suggest gmail.com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'contact@gamil.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('"gmail.com"')
        }
      })

      it('should reject glail.com and suggest gmail.com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'user@glail.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('"gmail.com"')
        }
      })

      it('should reject gmal.com and suggest gmail.com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'test@gmal.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('"gmail.com"')
        }
      })

      it('should reject icould.com and suggest icloud.com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'user@icould.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('"icloud.com"')
        }
      })

      it('should accept ymail.com, a real Yahoo domain', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'contact@ymail.com' })
        expect(result.success).toBe(true)
      })

      it('should accept any letter-only top-level domain', () => {
        for (const email of [
          'x@site.es',
          'x@site.mx',
          'x@site.xyz',
          'x@site.museum',
          'x@site.nl',
        ]) {
          expect(contactSchema.safeParse({ ...validData, email }).success).toBe(true)
        }
      })

      it('should reject a one-letter or numeric top-level domain', () => {
        for (const email of ['x@site.c', 'x@site.123', 'x@localhost']) {
          const result = contactSchema.safeParse({ ...validData, email })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please enter a valid email address')
          }
        }
      })

      it('should reject yhoo.com and suggest yahoo.com', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'hello@yhoo.com' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('"yahoo.com"')
        }
      })

      it('should accept valid .com email', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'test@example.com' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .net email', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'test@example.net' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .org email', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'test@example.org' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .edu email', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'student@university.edu' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .gov email', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'admin@agency.gov' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .io email', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'dev@startup.io' })
        expect(result.success).toBe(true)
      })

      it('should accept valid .co.uk email', () => {
        const result = contactSchema.safeParse({ ...validData, email: 'info@company.co.uk' })
        expect(result.success).toBe(true)
      })
    })

    describe('Phone validation', () => {
      it('should reject empty phone', () => {
        const result = contactSchema.safeParse({ ...validData, phone: '' })
        expect(result.success).toBe(false)
      })

      it('should accept 10-digit phone number', () => {
        const result = contactSchema.safeParse({ ...validData, phone: '5551234567' })
        expect(result.success).toBe(true)
      })

      it('should accept formatted phone number', () => {
        const result = contactSchema.safeParse({ ...validData, phone: '(555) 123-4567' })
        expect(result.success).toBe(true)
      })

      it('should reject phone with less than 10 digits', () => {
        const result = contactSchema.safeParse({ ...validData, phone: '555123456' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('10 digits')
        }
      })

      it('should reject phone with more than 10 digits', () => {
        const result = contactSchema.safeParse({ ...validData, phone: '55512345678' })
        expect(result.success).toBe(false)
      })

      it('should reject phone with letters', () => {
        const result = contactSchema.safeParse({ ...validData, phone: '555-CALL-NOW' })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('valid phone number')
        }
      })

      it('should accept phone with spaces and dashes', () => {
        const result = contactSchema.safeParse({ ...validData, phone: '555 123 4567' })
        expect(result.success).toBe(true)
      })

      it('should accept US forms with a country code or dots and store the national format', () => {
        for (const phone of ['+1 555 123 4567', '15551234567', '+15551234567', '555.123.4567']) {
          const result = contactSchema.safeParse({ ...validData, phone })
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.phone).toBe('(555) 123-4567')
          }
        }
      })
    })
  })

  describe('stateSchema - State Selection', () => {
    it('should accept a state from the list', () => {
      const result = stateSchema.safeParse({ state: 'California' })
      expect(result.success).toBe(true)
    })

    it('should reject a state outside the list', () => {
      for (const state of ['CA', 'Puerto Rico', 'california']) {
        const result = stateSchema.safeParse({ state })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Please select a state from the list')
        }
      }
    })

    it('should reject empty state', () => {
      const result = stateSchema.safeParse({ state: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('select your state')
      }
    })

    it('should reject missing state', () => {
      const result = stateSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('notePurposeSchema - Note Purpose', () => {
    it('should accept "work" as note purpose', () => {
      const result = notePurposeSchema.safeParse({ notePurpose: 'work' })
      expect(result.success).toBe(true)
    })

    it('should accept "school" as note purpose', () => {
      const result = notePurposeSchema.safeParse({ notePurpose: 'school' })
      expect(result.success).toBe(true)
    })

    it('should accept "both" as note purpose', () => {
      const result = notePurposeSchema.safeParse({ notePurpose: 'both' })
      expect(result.success).toBe(true)
    })

    it('should accept "other" with text description', () => {
      const result = notePurposeSchema.safeParse({
        notePurpose: 'other',
        otherNotePurpose: 'Personal reasons',
      })
      expect(result.success).toBe(true)
    })

    it('should reject legal matters as note purpose', () => {
      const result = notePurposeSchema.safeParse({ notePurpose: 'legal' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message === LEGAL_NOTE_PURPOSE_ERROR)
        ).toBe(true)
      }
    })

    it('should reject null note purpose', () => {
      const result = notePurposeSchema.safeParse({ notePurpose: null })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('select the purpose')
      }
    })

    it('should reject "other" without text description', () => {
      const result = notePurposeSchema.safeParse({ notePurpose: 'other' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('specify'))).toBe(true)
      }
    })

    it('should reject "other" with empty text description', () => {
      const result = notePurposeSchema.safeParse({ notePurpose: 'other', otherNotePurpose: '   ' })
      expect(result.success).toBe(false)
    })

    it('should reject other purpose text over 500 characters', () => {
      const result = notePurposeSchema.safeParse({
        notePurpose: 'other',
        otherNotePurpose: 'a'.repeat(501),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500 characters')
      }
    })

    it('should accept "work" without otherNotePurpose', () => {
      const result = notePurposeSchema.safeParse({ notePurpose: 'work' })
      expect(result.success).toBe(true)
    })
  })

  describe('absenceDatesSchema - Absence Dates', () => {
    const isoDaysFromToday = (days: number) => {
      const date = new Date()
      date.setUTCDate(date.getUTCDate() + days)
      return date.toISOString().split('T')[0]
    }

    it('should accept valid date range', () => {
      const result = absenceDatesSchema.safeParse({
        firstDayOff: isoDaysFromToday(-1),
        lastDayOff: isoDaysFromToday(3),
      })
      expect(result.success).toBe(true)
    })

    it('should apply the absence window rules', () => {
      const tooLong = absenceDatesSchema.safeParse({
        firstDayOff: isoDaysFromToday(0),
        lastDayOff: isoDaysFromToday(10),
      })
      expect(tooLong.success).toBe(false)
      if (!tooLong.success) {
        expect(tooLong.error.issues[0]).toMatchObject({
          path: ['lastDayOff'],
          message: 'Absence period cannot exceed 7 consecutive days',
        })
      }
      const tooOld = absenceDatesSchema.safeParse({
        firstDayOff: isoDaysFromToday(-30),
        lastDayOff: isoDaysFromToday(-30),
      })
      expect(tooOld.success).toBe(false)
      if (!tooOld.success) {
        expect(tooOld.error.issues[0].message).toBe(
          'First day off cannot be more than 7 days in the past'
        )
      }
      const notDates = absenceDatesSchema.safeParse({
        firstDayOff: '10/15/2026',
        lastDayOff: 'soon',
      })
      expect(notDates.success).toBe(false)
      if (!notDates.success) {
        expect(notDates.error.issues.map((issue) => issue.message)).toEqual([
          'Please enter a valid first day off',
          'Please enter a valid last day off',
        ])
      }
    })

    it('should reject empty first day off', () => {
      const result = absenceDatesSchema.safeParse({
        firstDayOff: '',
        lastDayOff: '2025-01-20',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('start date')
      }
    })

    it('should reject empty last day off', () => {
      const result = absenceDatesSchema.safeParse({
        firstDayOff: '2025-01-15',
        lastDayOff: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('end date')
      }
    })
  })

  describe('absenceReasonSchema - Absence Reason', () => {
    it('should accept valid absence reason', () => {
      const result = absenceReasonSchema.safeParse({ absenceReason: 'Feeling sick' })
      expect(result.success).toBe(true)
    })

    it('should accept "Other" with text description', () => {
      const result = absenceReasonSchema.safeParse({
        absenceReason: 'Other',
        otherAbsenceReason: 'Personal emergency',
      })
      expect(result.success).toBe(true)
    })

    it('should reject null absence reason', () => {
      const result = absenceReasonSchema.safeParse({ absenceReason: null })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('select a reason')
      }
    })

    it('should reject empty string absence reason', () => {
      const result = absenceReasonSchema.safeParse({ absenceReason: '   ' })
      expect(result.success).toBe(false)
    })

    it('should reject "Other" without text description', () => {
      const result = absenceReasonSchema.safeParse({ absenceReason: 'Other' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('specify'))).toBe(true)
      }
    })

    it('should reject "Other" with empty text', () => {
      const result = absenceReasonSchema.safeParse({
        absenceReason: 'Other',
        otherAbsenceReason: '   ',
      })
      expect(result.success).toBe(false)
    })

    it('should reject other reason over 200 characters', () => {
      const result = absenceReasonSchema.safeParse({
        absenceReason: 'Other',
        otherAbsenceReason: 'a'.repeat(201),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('200 characters')
      }
    })

    it('should accept non-Other reason without otherAbsenceReason', () => {
      const result = absenceReasonSchema.safeParse({ absenceReason: 'Feeling sick' })
      expect(result.success).toBe(true)
    })

    it('should reject a reason that is not one of the options', () => {
      const result = absenceReasonSchema.safeParse({ absenceReason: 'Illness' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please select a reason for your absence')
      }
    })
  })

  describe('symptomsSchema - Symptoms', () => {
    it('should accept array of symptoms', () => {
      const result = symptomsSchema.safeParse({ symptoms: ['Fever', 'Cough'] })
      expect(result.success).toBe(true)
    })

    it('should accept "Other" symptom with text description', () => {
      const result = symptomsSchema.safeParse({
        symptoms: ['Other'],
        otherSymptomText: 'Custom symptom description',
      })
      expect(result.success).toBe(true)
    })

    it('should accept symptoms without "Other"', () => {
      const result = symptomsSchema.safeParse({ symptoms: ['Fever', 'Headache'] })
      expect(result.success).toBe(true)
    })

    it('should reject empty symptoms and no text', () => {
      const result = symptomsSchema.safeParse({ symptoms: [] })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please select at least one option')
      }
    })

    it('should reject "Other" symptom without text description', () => {
      const result = symptomsSchema.safeParse({ symptoms: ['Other'] })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('describe'))).toBe(true)
      }
    })

    it('should reject "Other" with empty text', () => {
      const result = symptomsSchema.safeParse({ symptoms: ['Other'], otherSymptomText: '   ' })
      expect(result.success).toBe(false)
    })

    it('should reject other symptom text without a selected symptom', () => {
      const result = symptomsSchema.safeParse({ otherSymptomText: 'Custom symptoms' })
      expect(result.success).toBe(false)
    })

    it('should reject other symptom text over 500 characters', () => {
      const result = symptomsSchema.safeParse({
        symptoms: ['Other'],
        otherSymptomText: 'a'.repeat(501),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500 characters')
      }
    })

    it('should accept multiple symptoms including "Other" with text', () => {
      const result = symptomsSchema.safeParse({
        symptoms: ['Fever', 'Other'],
        otherSymptomText: 'Unusual symptom',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('customer copy', () => {
    const schemas = [
      recipientSchema,
      patientSchema,
      guardianSchema,
      contactSchema,
      stateSchema,
      notePurposeSchema,
      absenceDatesSchema,
      absenceReasonSchema,
      symptomsSchema,
      additionalInfoSchema,
      termsSchema,
    ]
    const drafts = [
      {},
      { recipient: 7, patientFirstName: 1, patientDateOfBirth: null, guardianFirstName: [] },
      { email: 1, phone: 2, state: 3, notePurpose: 4, otherNotePurpose: 5 },
      { firstDayOff: 1, lastDayOff: 2, absenceReason: 3, otherAbsenceReason: 4 },
      { symptoms: 'Fever', otherSymptomText: 1, additionalInformation: 1 },
      { certifyAccurate: 'yes', agreeTerms: 1, smsOptIn: 'no' },
    ]

    it('never shows a zod default message', () => {
      const messages = schemas.flatMap((schema) =>
        drafts.flatMap((draft) => {
          const result = schema.safeParse(draft)
          return result.success ? [] : result.error.issues.map((issue) => issue.message)
        })
      )
      expect(messages.length).toBeGreaterThan(20)
      expect(messages.filter((message) => /^Invalid|expected/i.test(message))).toEqual([])
    })
  })

  describe('additionalInfoSchema - Additional Information', () => {
    it('should accept empty additional information', () => {
      const result = additionalInfoSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should accept valid additional information', () => {
      const result = additionalInfoSchema.safeParse({ additionalInformation: 'Some extra details' })
      expect(result.success).toBe(true)
    })

    it('should reject additional information over 1000 characters', () => {
      const result = additionalInfoSchema.safeParse({ additionalInformation: 'a'.repeat(1001) })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('1000 characters')
      }
    })

    it('should accept exactly 1000 characters', () => {
      const result = additionalInfoSchema.safeParse({ additionalInformation: 'a'.repeat(1000) })
      expect(result.success).toBe(true)
    })

    it('should trim additional information', () => {
      const result = additionalInfoSchema.safeParse({ additionalInformation: '  Some text  ' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.additionalInformation).toBe('Some text')
      }
    })

    it('should transform empty string to undefined', () => {
      const result = additionalInfoSchema.safeParse({ additionalInformation: '   ' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.additionalInformation).toBe('')
      }
    })
  })

  describe('termsSchema - Terms and Conditions', () => {
    it('should accept both checkboxes as true', () => {
      const result = termsSchema.safeParse({
        certifyAccurate: true,
        agreeTerms: true,
        smsOptIn: true,
      })
      expect(result.success).toBe(true)
    })

    it('should reject certifyAccurate as false', () => {
      const result = termsSchema.safeParse({
        certifyAccurate: false,
        agreeTerms: true,
        smsOptIn: true,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('certify')
      }
    })

    it('should reject agreeTerms as false', () => {
      const result = termsSchema.safeParse({
        certifyAccurate: true,
        agreeTerms: false,
        smsOptIn: true,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('agree')
      }
    })

    it('should reject required checkboxes as false', () => {
      const result = termsSchema.safeParse({
        certifyAccurate: false,
        agreeTerms: false,
        smsOptIn: false,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('should accept smsOptIn as false', () => {
      const result = termsSchema.safeParse({
        certifyAccurate: true,
        agreeTerms: true,
        smsOptIn: false,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.smsOptIn).toBe(false)
      }
    })

    it('should reject missing certifyAccurate', () => {
      const result = termsSchema.safeParse({ agreeTerms: true, smsOptIn: true })
      expect(result.success).toBe(false)
    })

    it('should reject missing agreeTerms', () => {
      const result = termsSchema.safeParse({ certifyAccurate: true, smsOptIn: true })
      expect(result.success).toBe(false)
    })

    it('should default missing smsOptIn to false', () => {
      const result = termsSchema.safeParse({ certifyAccurate: true, agreeTerms: true })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.smsOptIn).toBe(false)
      }
    })
  })
})
