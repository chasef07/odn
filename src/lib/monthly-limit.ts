/**
 * Rolling 30-Day Limit Utilities
 * Calculate and track cumulative days off per patient in a rolling 30-day window
 */

import { SubmissionStatus } from '@prisma/client'
import { subDays, differenceInDays, startOfDay } from 'date-fns'
import prisma from './prisma'

export interface MonthlyUsage {
  totalDays: number
  submissions: Array<{
    id: string
    firstDayOff: Date
    lastDayOff: Date
    days: number
    approvedAt: Date | null
  }>
  exceedsLimit: boolean
  remainingDays: number
}

const ROLLING_LIMIT = 7 // Maximum days off allowed per 30-day rolling window
const WINDOW_DAYS = 30 // Lookback window in days

/**
 * Calculate total days off for a patient in a rolling 30-day window
 * @param patientFirstName - Patient first name (case-insensitive match)
 * @param patientLastName - Patient last name (case-insensitive match)
 * @param patientDateOfBirth - Patient date of birth (exact match)
 * @param referenceDate - The firstDayOff of the submission being reviewed
 * @returns MonthlyUsage object with total days and submission details
 */
export async function getMonthlyDaysUsed(
  patientFirstName: string,
  patientLastName: string,
  patientDateOfBirth: Date,
  referenceDate: Date
): Promise<MonthlyUsage> {
  // Normalize to start of day for consistent date comparison
  const normalizedReference = startOfDay(referenceDate)

  // Calculate 30-day window boundaries
  // Window is: [referenceDate - 30 days] to [referenceDate - 1 day]
  // This is EXCLUSIVE of the current submission's dates
  const windowStart = subDays(normalizedReference, WINDOW_DAYS)
  const windowEnd = subDays(normalizedReference, 1) // Exclusive of referenceDate itself

  // Query all APPROVED submissions for this patient (by name + DOB) where ANY day overlaps with the window
  // A submission overlaps if: firstDayOff <= windowEnd AND lastDayOff >= windowStart
  const submissions = await prisma.submission.findMany({
    where: {
      patientFirstName: { equals: patientFirstName, mode: 'insensitive' },
      patientLastName: { equals: patientLastName, mode: 'insensitive' },
      patientDateOfBirth: patientDateOfBirth,
      status: SubmissionStatus.APPROVED,
      // Submission's date range overlaps with the window
      firstDayOff: {
        lte: windowEnd, // Submission must start on or before window end
      },
      lastDayOff: {
        gte: windowStart, // Submission must end on or after window start
      },
    },
    select: {
      id: true,
      firstDayOff: true,
      lastDayOff: true,
      reviewedAt: true,
    },
    orderBy: {
      firstDayOff: 'asc',
    },
  })

  // Calculate days for each submission
  const submissionsWithDays = submissions.map((sub) => {
    const days = differenceInDays(sub.lastDayOff, sub.firstDayOff) + 1
    return {
      id: sub.id,
      firstDayOff: sub.firstDayOff,
      lastDayOff: sub.lastDayOff,
      days,
      approvedAt: sub.reviewedAt,
    }
  })

  // Sum total days
  const totalDays = submissionsWithDays.reduce((sum, sub) => sum + sub.days, 0)

  return {
    totalDays,
    submissions: submissionsWithDays,
    exceedsLimit: totalDays > ROLLING_LIMIT,
    remainingDays: Math.max(0, ROLLING_LIMIT - totalDays),
  }
}

/**
 * Check if adding a new request would exceed rolling 30-day limit
 * @param patientFirstName - Patient first name (case-insensitive match)
 * @param patientLastName - Patient last name (case-insensitive match)
 * @param patientDateOfBirth - Patient date of birth (exact match)
 * @param firstDayOff - First day off for new request (used as reference for 30-day window)
 * @param lastDayOff - Last day off for new request
 * @returns Object with current usage, new total, and whether it exceeds limit
 */
export async function wouldExceedMonthlyLimit(
  patientFirstName: string,
  patientLastName: string,
  patientDateOfBirth: Date,
  firstDayOff: Date,
  lastDayOff: Date
): Promise<{
  currentUsage: MonthlyUsage
  requestedDays: number
  newTotal: number
  wouldExceed: boolean
}> {
  const currentUsage = await getMonthlyDaysUsed(patientFirstName, patientLastName, patientDateOfBirth, firstDayOff)
  const requestedDays = differenceInDays(lastDayOff, firstDayOff) + 1
  const newTotal = currentUsage.totalDays + requestedDays

  return {
    currentUsage,
    requestedDays,
    newTotal,
    wouldExceed: newTotal > ROLLING_LIMIT,
  }
}
