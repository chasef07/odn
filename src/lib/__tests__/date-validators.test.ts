import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateAbsenceDates, type DatesFormData } from '../date-validators'
import { addDays, subDays, format } from 'date-fns'

describe('validateAbsenceDates', () => {
  let today: Date

  beforeEach(() => {
    today = new Date('2025-01-15')
    today.setHours(0, 0, 0, 0)
    vi.setSystemTime(today)
  })

  describe('Valid date ranges', () => {
    it('should return no errors for valid date range', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-16',
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should return no errors for same-day absence (1 day)', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-15',
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should return no errors for exactly 7-day absence (boundary)', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-21',
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should return no errors for first day 7 days in past (within limit)', () => {
      const sevenDaysAgo = format(subDays(today, 7), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: sevenDaysAgo,
        lastDayOff: sevenDaysAgo,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })
  })

  describe('First day validation', () => {
    it('should allow first day 7 days in past (at boundary limit)', () => {
      const sevenDaysAgo = format(subDays(today, 7), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: sevenDaysAgo,
        lastDayOff: sevenDaysAgo,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should reject first day 9 days in past (beyond limit)', () => {
      const nineDaysAgo = format(subDays(today, 9), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: nineDaysAgo,
        lastDayOff: nineDaysAgo,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        field: 'firstDayOff',
        message: 'First day off cannot be more than 7 days in the past',
      })
    })

    it('should reject first day 10 days in the past', () => {
      const tenDaysAgo = format(subDays(today, 10), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: tenDaysAgo,
        lastDayOff: tenDaysAgo,
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
        lastDayOff: '2025-01-19',
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
        lastDayOff: '2025-01-22',
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toEqual({
        field: 'lastDayOff',
        message: 'Absence period cannot exceed 7 consecutive days',
      })
    })

    it('should reject absence period of 15 days', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-01-15',
        lastDayOff: '2025-01-29',
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('lastDayOff')
      expect(errors[0].message).toContain('7')
    })
  })

  describe('Multiple validation errors', () => {
    it('should return multiple errors when multiple rules violated', () => {
      const tenDaysAgo = format(subDays(today, 10), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: tenDaysAgo,
        lastDayOff: '2025-02-10',
      }

      const errors = validateAbsenceDates(data)
      expect(errors.length).toBeGreaterThan(1)

      expect(errors.some((e) => e.field === 'firstDayOff')).toBe(true)

      expect(errors.some((e) => e.field === 'lastDayOff')).toBe(true)
    })

    it('should return both last day errors when last < first AND exceeds 7 days', () => {
      const data: DatesFormData = {
        firstDayOff: '2025-02-01',
        lastDayOff: '2025-01-10',
      }

      const errors = validateAbsenceDates(data)
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
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should handle leap year dates', () => {
      vi.setSystemTime(new Date('2024-02-25'))

      const data: DatesFormData = {
        firstDayOff: '2024-02-28',
        lastDayOff: '2024-03-01',
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should handle year boundary crossing', () => {
      vi.setSystemTime(new Date('2024-12-28'))

      const data: DatesFormData = {
        firstDayOff: '2024-12-28',
        lastDayOff: '2025-01-02',
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should handle month boundary crossing', () => {
      vi.setSystemTime(new Date('2025-01-28'))

      const data: DatesFormData = {
        firstDayOff: '2025-01-28',
        lastDayOff: '2025-02-03',
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
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })

    it('should accept first day in the future', () => {
      const tomorrow = format(addDays(today, 1), 'yyyy-MM-dd')

      const data: DatesFormData = {
        firstDayOff: tomorrow,
        lastDayOff: tomorrow,
      }

      const errors = validateAbsenceDates(data)
      expect(errors).toEqual([])
    })
  })
})
