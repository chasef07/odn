import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SubmissionStatus } from '@prisma/client'
import { subDays, addDays } from 'date-fns'

// Mock Prisma
const mockFindMany = vi.fn()
vi.mock('../prisma', () => ({
  default: {
    submission: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

// Import after mocking
import { getMonthlyDaysUsed, wouldExceedMonthlyLimit } from '../monthly-limit'

// Test patient details
const testPatient = {
  firstName: 'John',
  lastName: 'Doe',
  dob: new Date('1990-05-15'),
}

describe('monthly-limit (rolling 30-day window)', () => {
  let referenceDate: Date

  beforeEach(() => {
    // Mock consistent reference date for predictable testing
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

        expect(result.totalDays).toBe(3) // 3 days: day -10, -9, -8
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

        expect(result.totalDays).toBe(5) // 2 + 3 days
        expect(result.submissions).toHaveLength(2)
      })

      it('should use case-insensitive name matching', async () => {
        mockFindMany.mockResolvedValue([])

        await getMonthlyDaysUsed('JOHN', 'DOE', testPatient.dob, referenceDate)

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              patientFirstName: { equals: 'JOHN', mode: 'insensitive' },
              patientLastName: { equals: 'DOE', mode: 'insensitive' },
              patientDateOfBirth: testPatient.dob,
            }),
          })
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

        // Window should be [referenceDate - 30] to [referenceDate - 1]
        // Query finds overlapping submissions: firstDayOff <= windowEnd AND lastDayOff >= windowStart
        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              firstDayOff: { lte: subDays(referenceDate, 1) },
              lastDayOff: { gte: subDays(referenceDate, 30) },
            }),
          })
        )
      })
    })

    describe('submission spanning window boundary (count ALL days)', () => {
      it('should count ALL days when submission starts before window', async () => {
        // Submission starts 35 days ago (before window), ends 28 days ago (within window)
        // Window: [-30, -1] relative to referenceDate
        // Submission: [-35, -28] - 8 days total
        // Even though only some days are in window, count ALL 8 days
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

        expect(result.totalDays).toBe(8) // ALL days, not just days in window
      })

      it('should count ALL days when submission ends after window end', async () => {
        // Submission starts 5 days ago (within window), ends today (after window end which is yesterday)
        // Window end is referenceDate - 1 (yesterday)
        // Submission: [-5, 0] - 6 days total
        // Count all 6 days even though some are outside window
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
        // Submission: 40 days ago to yesterday (spans entire 30-day window)
        // Total: 40 days
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
        // Window start: referenceDate - 30 days
        // Submission ends exactly on window start - should be INCLUDED
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 32),
            lastDayOff: subDays(referenceDate, 30), // Exactly on window start
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
        // Window end: referenceDate - 1 day (yesterday)
        // Submission starts exactly on window end - should be INCLUDED
        mockFindMany.mockResolvedValue([
          {
            id: 'sub-1',
            firstDayOff: subDays(referenceDate, 1), // Exactly on window end
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
            lastDayOff: subDays(referenceDate, 12), // 9 days
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
            lastDayOff: subDays(referenceDate, 14), // 7 days
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

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: SubmissionStatus.APPROVED,
            }),
          })
        )
      })
    })
  })

  describe('wouldExceedMonthlyLimit', () => {
    it('should calculate new total correctly', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 'sub-1',
          firstDayOff: subDays(referenceDate, 10),
          lastDayOff: subDays(referenceDate, 8), // 3 days
          reviewedAt: subDays(referenceDate, 7),
        },
      ])

      const firstDayOff = referenceDate
      const lastDayOff = addDays(referenceDate, 2) // Requesting 3 days

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
          lastDayOff: subDays(referenceDate, 5), // 6 days
          reviewedAt: subDays(referenceDate, 4),
        },
      ])

      const firstDayOff = referenceDate
      const lastDayOff = addDays(referenceDate, 2) // Requesting 3 days

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
        referenceDate // Same day = 1 day request
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
        // Verify window was calculated from yesterday, not today
        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              firstDayOff: { lte: subDays(yesterday, 1) },
              lastDayOff: { gte: subDays(yesterday, 30) },
            }),
          })
        )
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

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              firstDayOff: { lte: subDays(sevenDaysAgo, 1) },
              lastDayOff: { gte: subDays(sevenDaysAgo, 30) },
            }),
          })
        )
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

        // Verify function executed successfully and query was made
        expect(result.totalDays).toBe(0)
        expect(mockFindMany).toHaveBeenCalledTimes(1)

        // Verify the query structure is correct (window extends into February)
        const callArgs = mockFindMany.mock.calls[0][0]
        expect(callArgs.where.firstDayOff.lte).toBeDefined()
        expect(callArgs.where.lastDayOff.gte).toBeDefined()
        // Window start should be in February (month index 1)
        expect(callArgs.where.lastDayOff.gte.getMonth()).toBe(1) // February
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

        // Verify function executed successfully
        expect(result.totalDays).toBe(0)
        expect(mockFindMany).toHaveBeenCalledTimes(1)

        // Verify the window extends into December 2024
        const callArgs = mockFindMany.mock.calls[0][0]
        expect(callArgs.where.lastDayOff.gte.getFullYear()).toBe(2024)
        expect(callArgs.where.lastDayOff.gte.getMonth()).toBe(11) // December
      })
    })
  })
})
