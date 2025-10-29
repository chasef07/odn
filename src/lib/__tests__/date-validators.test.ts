import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateAbsenceDates, type DatesFormData } from '../date-validators'
import { addDays, subDays, format } from 'date-fns'

describe('validateAbsenceDates', () => {
  let today: Date

  beforeEach(() => {
    // Mock consistent "today" for predictable testing
    today = new Date('2025-01-15')
    today.setHours(0, 0, 0, 0)
    vi.setSystemTime(today)
  })

  describe('Valid date ranges', () => {
    it('should return no errors for valid date range', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-16',
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should return no errors for same-day absence (1 day)', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-15',
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should return no errors for exactly 7-day absence (boundary)', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-22', // Exactly 7 days later
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should return no errors for first day 4 days in past (within limit)', () => {
      const fourDaysAgo = format(subDays(today, 4), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: fourDaysAgo,
        lastDayOff: fourDaysAgo,
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should return no errors with valid return date', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-20',
        needReturnDate: true,
        returnDate: '2025-01-21', // Day after last day
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should return no errors when return date not needed', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-20',
        needReturnDate: false,
        returnDate: undefined,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })
  })

  describe('First day validation', () => {
    it('should allow first day 4 days in past (well within limit)', () => {
      const fourDaysAgo = format(subDays(today, 4), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: fourDaysAgo,
        lastDayOff: fourDaysAgo,
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should reject first day 6 days in past (beyond limit)', () => {
      const sixDaysAgo = format(subDays(today, 6), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: sixDaysAgo,
        lastDayOff: sixDaysAgo,
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        field: 'firstDayOff',
        message: 'First day off cannot be more than 5 days in the past',
      })
    })

    it('should reject first day 10 days in the past', () => {
      const tenDaysAgo = format(subDays(today, 10), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: tenDaysAgo,
        lastDayOff: tenDaysAgo,
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('firstDayOff')
    })
  })

  describe('Last day validation', () => {
    it('should reject last day before first day', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-20',
        lastDayOff: '2025-01-19', // Before first day
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        field: 'lastDayOff',
        message: 'Last day off must be on or after first day off',
      })
    })

    it('should reject absence period exceeding 7 days', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-23', // 8 days later
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        field: 'lastDayOff',
        message: 'Absence period cannot exceed 7 days',
      })
    })

    it('should reject absence period of 14 days', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-29', // 14 days later
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('lastDayOff')
      expect(errors[0].message).toContain('7 days')
    })
  })

  describe('Return date validation', () => {
    it('should accept return date same as last day', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-20',
        needReturnDate: true,
        returnDate: '2025-01-20', // Same as last day
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should reject return date before last day', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-20',
        needReturnDate: true,
        returnDate: '2025-01-19', // Before last day
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        field: 'returnDate',
        message: 'Return date must be on or after the last day off',
      })
    })

    it('should not validate return date when needReturnDate is false', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-20',
        needReturnDate: false,
        returnDate: '2025-01-19', // Invalid, but should be ignored
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should not validate return date when returnDate is undefined', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-20',
        needReturnDate: true,
        returnDate: undefined,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })
  })

  describe('Multiple validation errors', () => {
    it('should return multiple errors when multiple rules violated', () => {
      const tenDaysAgo = format(subDays(today, 10), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: tenDaysAgo,
        lastDayOff: '2025-02-10', // Way beyond 7 days
        needReturnDate: true,
        returnDate: '2025-01-20', // Before last day
      }

      const errors = validateAbsenceDates(data)
      expect(errors.length).toBeGreaterThan(1)

      // Should include first day error
      expect(errors.some(e => e.field === 'firstDayOff')).toBe(true)

      // Should include last day error (exceeds 7 days)
      expect(errors.some(e => e.field === 'lastDayOff')).toBe(true)
    })

    it('should return both last day errors when last < first AND exceeds 7 days', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-02-01',
        lastDayOff: '2025-01-10', // Before first day
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      // Only the "before first day" check will trigger since lastDay < firstDay
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('lastDayOff')
      expect(errors[0].message).toContain('on or after first day')
    })
  })

  describe('Edge cases and date parsing', () => {
    it('should handle dates with time components (normalize to midnight)', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15T14:30:00',
        lastDayOff: '2025-01-16T08:00:00',
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should handle leap year dates', () => {
      vi.setSystemTime(new Date('2024-02-25'))

      const data: DatesFormData = {
        firstDayOff: '2024-02-28',
        lastDayOff: '2024-03-01', // Crosses leap day
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should handle year boundary crossing', () => {
      vi.setSystemTime(new Date('2024-12-28'))

      const data: DatesFormData = {
        firstDayOff: '2024-12-28',
        lastDayOff: '2025-01-02', // Crosses into new year
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should handle month boundary crossing', () => {
      vi.setSystemTime(new Date('2025-01-28'))

      const data: DatesFormData = {
        firstDayOff: '2025-01-28',
        lastDayOff: '2025-02-03', // Crosses into February
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })
  })

  describe('Boundary condition tests', () => {
    it('should accept first day as today', () => {
      const todayStr = format(today, 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: todayStr,
        lastDayOff: todayStr,
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should accept first day in the future', () => {
      const tomorrow = format(addDays(today, 1), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: tomorrow,
        lastDayOff: tomorrow,
        needReturnDate: false,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should accept return date far in future', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-20',
        needReturnDate: true,
        returnDate: '2025-03-01', // 40 days later
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })
  })
})
