import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { subDays, addDays } from 'date-fns'

const mockFindMany = vi.fn()
vi.mock('@/db/submissions', () => ({
  findApprovedSubmissionsOverlapping: (...args: unknown[]) => mockFindMany(...args),
}))

import { getMonthlyDaysUsed, wouldExceedMonthlyLimit } from '../monthly-limit'

const testPatient = {
  firstName: 'John',
  lastName: 'Doe',
  dob: new Date('1990-05-15'),
}

const testPatientIdentity = {
  patientFirstName: testPatient.firstName,
  patientLastName: testPatient.lastName,
  patientDateOfBirth: testPatient.dob,
}

describe('monthly-limit (rolling 30-day window)', () => {
  let referenceDate: Date

  beforeEach(() => {
    referenceDate = new Date('2025-01-15')
    referenceDate.setHours(0, 0, 0, 0)
    vi.setSystemTime(referenceDate)
    mockFindMany.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getMonthlyDaysUsed', () => {
    describe('basic functionality', () => {
      it('should return zero days when no prior submissions', async () => {
        mockFindMany.mockResolvedValue([])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(0)
        expect(result.submissions).toHaveLength(0)
        expect(result.exceedsLimit).toBe(false)
        expect(result.remainingDays).toBe(7)
      })

      it('should count days from a single submission within window', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 10),
            lastDayOff: subDays(referenceDate, 8),
            reviewedAt: subDays(referenceDate, 7),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(3)
        expect(result.submissions).toHaveLength(1)
        expect(result.remainingDays).toBe(4)
      })

      it('should sum days from multiple submissions', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 25),
            lastDayOff: subDays(referenceDate, 24),
            reviewedAt: subDays(referenceDate, 23),
          },
          {
            id: 'sub-2',
            firstDayOff: subDays(referenceDate, 10),
            lastDayOff: subDays(referenceDate, 8),
            reviewedAt: subDays(referenceDate, 7),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(5)
        expect(result.submissions).toHaveLength(2)
      })

      it('should use case-insensitive name matching', async () => {
        mockFindMany.mockResolvedValue([])

        await getMonthlyDaysUsed('JOHN', 'DOE', testPatient.dob, referenceDate)

        expect(mockFindMany).toHaveBeenCalledWith(
          {
            patientFirstName: 'JOHN',
            patientLastName: 'DOE',
            patientDateOfBirth: testPatient.dob,
          },
          {
            windowStart: subDays(referenceDate, 30),
            windowEnd: subDays(referenceDate, 1),
          }
        )
      })
    })

    describe('window boundary logic', () => {
      it('should query with correct 30-day window boundaries', async () => {
        mockFindMany.mockResolvedValue([])

        await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(mockFindMany).toHaveBeenCalledWith(testPatientIdentity, {
          windowStart: subDays(referenceDate, 30),
          windowEnd: subDays(referenceDate, 1),
        })
      })
    })

    describe('submission spanning window boundary (count ALL days)', () => {
      it('should count ALL days when submission starts before window', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 35),
            lastDayOff: subDays(referenceDate, 28),
            reviewedAt: subDays(referenceDate, 27),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(8)
      })

      it('should count ALL days when submission ends after window end', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 5),
            lastDayOff: referenceDate,
            reviewedAt: subDays(referenceDate, 4),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(6)
      })

      it('should count ALL days when submission spans entire window', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 40),
            lastDayOff: subDays(referenceDate, 1),
            reviewedAt: subDays(referenceDate, 40),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(40)
      })
    })

    describe('submissions exactly on boundary dates', () => {
      it('should include submission ending exactly on window start', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 32),
            lastDayOff: subDays(referenceDate, 30),
            reviewedAt: subDays(referenceDate, 29),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(3)
      })

      it('should include submission starting exactly on window end', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 1),
            lastDayOff: referenceDate,
            reviewedAt: subDays(referenceDate, 1),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(2)
      })
    })

    describe('limit tracking', () => {
      it('should set exceedsLimit true when over 7 days', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 20),
            lastDayOff: subDays(referenceDate, 12),
            reviewedAt: subDays(referenceDate, 11),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(9)
        expect(result.exceedsLimit).toBe(true)
        expect(result.remainingDays).toBe(0)
      })

      it('should set exceedsLimit false when exactly at 7 days', async () => {
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 20),
            lastDayOff: subDays(referenceDate, 14),
            reviewedAt: subDays(referenceDate, 13),
          },
        ])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(result.totalDays).toBe(7)
        expect(result.exceedsLimit).toBe(false)
        expect(result.remainingDays).toBe(0)
      })
    })

    describe('only APPROVED submissions counted', () => {
      it('should only query for APPROVED status', async () => {
        mockFindMany.mockResolvedValue([])

        await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          referenceDate
        )

        expect(mockFindMany).toHaveBeenCalledWith(testPatientIdentity, {
          windowStart: subDays(referenceDate, 30),
          windowEnd: subDays(referenceDate, 1),
        })
      })
    })
  })

  describe('wouldExceedMonthlyLimit', () => {
    it('should calculate new total correctly', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 'sub-1',
          firstDayOff: subDays(referenceDate, 10),
          lastDayOff: subDays(referenceDate, 8),
          reviewedAt: subDays(referenceDate, 7),
        },
      ])

      const firstDayOff = referenceDate
      const lastDayOff = addDays(referenceDate, 2)

      const result = await wouldExceedMonthlyLimit(
        testPatient.firstName,
        testPatient.lastName,
        testPatient.dob,
        firstDayOff,
        lastDayOff
      )

      expect(result.currentUsage.totalDays).toBe(3)
      expect(result.requestedDays).toBe(3)
      expect(result.newTotal).toBe(6)
      expect(result.wouldExceed).toBe(false)
    })

    it('should return wouldExceed true when new total exceeds 7', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 'sub-1',
          firstDayOff: subDays(referenceDate, 10),
          lastDayOff: subDays(referenceDate, 5),
          reviewedAt: subDays(referenceDate, 4),
        },
      ])

      const firstDayOff = referenceDate
      const lastDayOff = addDays(referenceDate, 2)

      const result = await wouldExceedMonthlyLimit(
        testPatient.firstName,
        testPatient.lastName,
        testPatient.dob,
        firstDayOff,
        lastDayOff
      )

      expect(result.currentUsage.totalDays).toBe(6)
      expect(result.requestedDays).toBe(3)
      expect(result.newTotal).toBe(9)
      expect(result.wouldExceed).toBe(true)
    })

    it('should handle single-day request', async () => {
      mockFindMany.mockResolvedValue([])

      const result = await wouldExceedMonthlyLimit(
        testPatient.firstName,
        testPatient.lastName,
        testPatient.dob,
        referenceDate,
        referenceDate
      )

      expect(result.requestedDays).toBe(1)
      expect(result.newTotal).toBe(1)
      expect(result.wouldExceed).toBe(false)
    })
  })

  describe('edge cases', () => {
    describe('reference date in the past', () => {
      it('should handle reference date being yesterday', async () => {
        const yesterday = subDays(referenceDate, 1)
        mockFindMany.mockResolvedValue([])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          yesterday
        )

        expect(result.totalDays).toBe(0)
        expect(mockFindMany).toHaveBeenCalledWith(testPatientIdentity, {
          windowStart: subDays(yesterday, 30),
          windowEnd: subDays(yesterday, 1),
        })
      })

      it('should handle reference date 7 days in the past', async () => {
        const sevenDaysAgo = subDays(referenceDate, 7)
        mockFindMany.mockResolvedValue([])

        await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          sevenDaysAgo
        )

        expect(mockFindMany).toHaveBeenCalledWith(testPatientIdentity, {
          windowStart: subDays(sevenDaysAgo, 30),
          windowEnd: subDays(sevenDaysAgo, 1),
        })
      })
    })

    describe('window crossing month boundary', () => {
      it('should handle window crossing into previous month', async () => {
        const marchDate = new Date('2025-03-10T00:00:00.000Z')
        vi.setSystemTime(marchDate)
        mockFindMany.mockResolvedValue([])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          marchDate
        )

        expect(result.totalDays).toBe(0)
        expect(mockFindMany).toHaveBeenCalledTimes(1)

        const window = mockFindMany.mock.calls[0][1]
        expect(window.windowEnd).toBeDefined()
        expect(window.windowStart).toBeDefined()
        expect(window.windowStart.getMonth()).toBe(1)
      })
    })

    describe('window crossing year boundary', () => {
      it('should handle window crossing into previous year', async () => {
        const janDate = new Date('2025-01-10T00:00:00.000Z')
        vi.setSystemTime(janDate)
        mockFindMany.mockResolvedValue([])

        const result = await getMonthlyDaysUsed(
          testPatient.firstName,
          testPatient.lastName,
          testPatient.dob,
          janDate
        )

        expect(result.totalDays).toBe(0)
        expect(mockFindMany).toHaveBeenCalledTimes(1)

        const window = mockFindMany.mock.calls[0][1]
        expect(window.windowStart.getFullYear()).toBe(2024)
        expect(window.windowStart.getMonth()).toBe(11)
      })
    })
  })
})
