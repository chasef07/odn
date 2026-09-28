import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isAgeValid, createAgeValidator } from '../age-validators'
import { subYears, subDays, addDays, format } from 'date-fns'
import { z } from 'zod'

describe('age-validators', () => {
  let today: Date

  beforeEach(() => {
    today = new Date('2025-01-15')
    today.setHours(0, 0, 0, 0)
    vi.setSystemTime(today)
  })

  describe('isAgeValid', () => {
    describe('Default minimum age (18)', () => {
      it('should return true for someone exactly 18 years old today', () => {
        const eighteenYearsAgo = format(subYears(today, 18), 'yyyy-MM-dd')
        expect(isAgeValid(eighteenYearsAgo)).toBe(true)
      })

      it('should return true for someone 19 years old', () => {
        const nineteenYearsAgo = format(subYears(today, 19), 'yyyy-MM-dd')
        expect(isAgeValid(nineteenYearsAgo)).toBe(true)
      })

      it('should return true for someone 30 years old', () => {
        const thirtyYearsAgo = format(subYears(today, 30), 'yyyy-MM-dd')
        expect(isAgeValid(thirtyYearsAgo)).toBe(true)
      })

      it('should return true for someone 100 years old', () => {
        const hundredYearsAgo = format(subYears(today, 100), 'yyyy-MM-dd')
        expect(isAgeValid(hundredYearsAgo)).toBe(true)
      })

      it('should return false for someone 17 years old', () => {
        const seventeenYearsAgo = format(subYears(today, 17), 'yyyy-MM-dd')
        expect(isAgeValid(seventeenYearsAgo)).toBe(false)
      })

      it('should return false for someone 10 years old', () => {
        const tenYearsAgo = format(subYears(today, 10), 'yyyy-MM-dd')
        expect(isAgeValid(tenYearsAgo)).toBe(false)
      })

      it('should return false for someone 0 years old (born today)', () => {
        const todayStr = format(today, 'yyyy-MM-dd')
        expect(isAgeValid(todayStr)).toBe(false)
      })

      it('should return false for someone born yesterday', () => {
        const yesterday = format(subDays(today, 1), 'yyyy-MM-dd')
        expect(isAgeValid(yesterday)).toBe(false)
      })
    })

    describe('Custom minimum ages', () => {
      it('should validate 21+ age requirement', () => {
        const twentyOneYearsAgo = format(subYears(today, 21), 'yyyy-MM-dd')
        const twentyYearsAgo = format(subYears(today, 20), 'yyyy-MM-dd')

        expect(isAgeValid(twentyOneYearsAgo, 21)).toBe(true)
        expect(isAgeValid(twentyYearsAgo, 21)).toBe(false)
      })

      it('should validate 13+ age requirement', () => {
        const thirteenYearsAgo = format(subYears(today, 13), 'yyyy-MM-dd')
        const twelveYearsAgo = format(subYears(today, 12), 'yyyy-MM-dd')

        expect(isAgeValid(thirteenYearsAgo, 13)).toBe(true)
        expect(isAgeValid(twelveYearsAgo, 13)).toBe(false)
      })

      it('should validate 65+ age requirement (senior)', () => {
        const sixtyFiveYearsAgo = format(subYears(today, 65), 'yyyy-MM-dd')
        const sixtyFourYearsAgo = format(subYears(today, 64), 'yyyy-MM-dd')

        expect(isAgeValid(sixtyFiveYearsAgo, 65)).toBe(true)
        expect(isAgeValid(sixtyFourYearsAgo, 65)).toBe(false)
      })

      it('should validate 0+ age requirement (any age)', () => {
        const todayStr = format(today, 'yyyy-MM-dd')
        const tenYearsAgo = format(subYears(today, 10), 'yyyy-MM-dd')

        expect(isAgeValid(todayStr, 0)).toBe(true)
        expect(isAgeValid(tenYearsAgo, 0)).toBe(true)
      })
    })

    describe('Birthday edge cases', () => {
      it('should return true on 18th birthday (today)', () => {
        const eighteenYearsAgo = format(subYears(today, 18), 'yyyy-MM-dd')
        expect(isAgeValid(eighteenYearsAgo)).toBe(true)
      })

      it('should return false the day before 18th birthday', () => {
        const almostEighteen = format(addDays(subYears(today, 18), 1), 'yyyy-MM-dd')
        expect(isAgeValid(almostEighteen)).toBe(false)
      })

      it('should return true the day after 18th birthday', () => {
        const dayAfter = format(subDays(subYears(today, 18), 1), 'yyyy-MM-dd')
        expect(isAgeValid(dayAfter)).toBe(true)
      })
    })

    describe('Leap year dates', () => {
      it('should handle Feb 29 leap year birthday', () => {
        vi.setSystemTime(new Date('2024-03-01'))

        expect(isAgeValid('1996-02-29', 18)).toBe(true)
        expect(isAgeValid('2008-02-29', 18)).toBe(false)
      })

      it('should handle leap year birthday on leap day', () => {
        vi.setSystemTime(new Date('2024-02-29'))

        expect(isAgeValid('2000-02-29', 18)).toBe(true)
      })

      it('should handle leap year birthday on non-leap year', () => {
        vi.setSystemTime(new Date('2025-02-28'))

        expect(isAgeValid('2000-02-29', 18)).toBe(true)
      })
    })

    describe('Date format variations', () => {
      it('should handle ISO date format', () => {
        expect(isAgeValid('2000-01-15', 18)).toBe(true)
      })

      it('should handle date with time component', () => {
        const eighteenYearsAgo = subYears(today, 18).toISOString()
        expect(isAgeValid(eighteenYearsAgo, 18)).toBe(true)
      })

      it('should handle various valid date formats', () => {
        expect(isAgeValid('2000-01-15T00:00:00Z', 18)).toBe(true)
        expect(isAgeValid('2000-01-15T12:30:00', 18)).toBe(true)
      })
    })

    describe('Edge cases and boundary conditions', () => {
      it('should handle very old ages (120+ years)', () => {
        const veryOld = format(subYears(today, 120), 'yyyy-MM-dd')
        expect(isAgeValid(veryOld, 18)).toBe(true)
      })

      it('should handle future dates (negative age)', () => {
        const tomorrow = format(addDays(today, 1), 'yyyy-MM-dd')
        expect(isAgeValid(tomorrow, 18)).toBe(false)
      })

      it('should handle dates far in the future', () => {
        expect(isAgeValid('2100-01-01', 18)).toBe(false)
      })

      it('should handle historical dates (1900s)', () => {
        expect(isAgeValid('1950-01-15', 18)).toBe(true)
      })
    })

    describe('Year boundaries', () => {
      it('should handle birthday crossing year boundary', () => {
        vi.setSystemTime(new Date('2025-01-01'))

        const eighteenYearsAgo = format(subYears(new Date('2025-01-01'), 18), 'yyyy-MM-dd')
        expect(isAgeValid(eighteenYearsAgo, 18)).toBe(true)
      })

      it('should handle December birthday in January', () => {
        vi.setSystemTime(new Date('2025-01-15'))

        expect(isAgeValid('2006-12-31', 18)).toBe(true)
        expect(isAgeValid('2007-12-31', 18)).toBe(false)
      })
    })
  })

  describe('createAgeValidator', () => {
    describe('Default parameters (18 years, "You")', () => {
      it('should create validator that accepts 18+', () => {
        const validator = createAgeValidator()
        const eighteenYearsAgo = format(subYears(today, 18), 'yyyy-MM-dd')

        const result = validator.safeParse(eighteenYearsAgo)
        expect(result.success).toBe(true)
      })

      it('should create validator that rejects under 18', () => {
        const validator = createAgeValidator()
        const seventeenYearsAgo = format(subYears(today, 17), 'yyyy-MM-dd')

        const result = validator.safeParse(seventeenYearsAgo)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('You must be 18 years or older')
        }
      })

      it('should use default error message with "You"', () => {
        const validator = createAgeValidator()
        const result = validator.safeParse('2020-01-01')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('You')
          expect(result.error.issues[0].message).toContain('18')
        }
      })
    })

    describe('Custom minimum age', () => {
      it('should create validator for 21+ requirement', () => {
        const validator = createAgeValidator(21)
        const twentyOneYearsAgo = format(subYears(today, 21), 'yyyy-MM-dd')
        const twentyYearsAgo = format(subYears(today, 20), 'yyyy-MM-dd')

        expect(validator.safeParse(twentyOneYearsAgo).success).toBe(true)
        expect(validator.safeParse(twentyYearsAgo).success).toBe(false)
      })

      it('should create validator for 13+ requirement', () => {
        const validator = createAgeValidator(13, 'Child')
        const thirteenYearsAgo = format(subYears(today, 13), 'yyyy-MM-dd')

        const result = validator.safeParse(thirteenYearsAgo)
        expect(result.success).toBe(true)
      })

      it('should show correct age in error message', () => {
        const validator = createAgeValidator(25)
        const result = validator.safeParse('2020-01-01')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('25')
        }
      })
    })

    describe('Custom field name', () => {
      it('should use custom field name in error message', () => {
        const validator = createAgeValidator(18, 'Patient')
        const result = validator.safeParse('2020-01-01')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Patient must be 18 years or older')
        }
      })

      it('should handle "The patient" field name', () => {
        const validator = createAgeValidator(21, 'The patient')
        const result = validator.safeParse('2020-01-01')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('The patient must be 21 years or older')
        }
      })

      it('should handle "Your child" field name', () => {
        const validator = createAgeValidator(16, 'Your child')
        const result = validator.safeParse('2020-01-01')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Your child must be 16 years or older')
        }
      })
    })

    describe('Combined custom parameters', () => {
      it('should use both custom age and field name', () => {
        const validator = createAgeValidator(65, 'Senior applicant')
        const result = validator.safeParse('2000-01-01')

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Senior applicant must be 65 years or older')
        }
      })
    })

    describe('Integration with Zod schema', () => {
      it('should work in a Zod object schema', () => {
        const schema = z.object({
          dateOfBirth: createAgeValidator(18, 'Applicant'),
        })

        const validData = {
          dateOfBirth: format(subYears(today, 18), 'yyyy-MM-dd'),
        }
        const invalidData = {
          dateOfBirth: format(subYears(today, 17), 'yyyy-MM-dd'),
        }

        expect(schema.safeParse(validData).success).toBe(true)
        expect(schema.safeParse(invalidData).success).toBe(false)
      })

      it('should work with optional() wrapper', () => {
        const schema = z.object({
          dateOfBirth: createAgeValidator(18).optional(),
        })

        expect(schema.safeParse({}).success).toBe(true)

        const validDate = format(subYears(today, 18), 'yyyy-MM-dd')
        expect(schema.safeParse({ dateOfBirth: validDate }).success).toBe(true)

        const invalidDate = format(subYears(today, 17), 'yyyy-MM-dd')
        expect(schema.safeParse({ dateOfBirth: invalidDate }).success).toBe(false)
      })
    })
  })
})
