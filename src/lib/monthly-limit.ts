/**
 * Monthly Limit Utilities
 * Calculate and track cumulative days off per patient per month
 */

import { SubmissionStatus } from '@prisma/client'
import { startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
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

const MONTHLY_LIMIT = 7 // Maximum days off allowed per month

/**
 * Calculate total days off for a patient in a given month
 * @param email - Patient email address
 * @param referenceDate - Any date within the month to check
 * @returns MonthlyUsage object with total days and submission details
 */
export async function getMonthlyDaysUsed(
  email: string,
  referenceDate: Date
): Promise<MonthlyUsage> {
  const monthStart = startOfMonth(referenceDate)
  const monthEnd = endOfMonth(referenceDate)

  // Query all APPROVED submissions for this email in this month
  const submissions = await prisma.submission.findMany({
    where: {
      email: email.toLowerCase(),
      status: SubmissionStatus.APPROVED,
      firstDayOff: {
        gte: monthStart,
        lte: monthEnd,
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
    exceedsLimit: totalDays > MONTHLY_LIMIT,
    remainingDays: Math.max(0, MONTHLY_LIMIT - totalDays),
  }
}

/**
 * Check if adding a new request would exceed monthly limit
 * @param email - Patient email address
 * @param firstDayOff - First day off for new request
 * @param lastDayOff - Last day off for new request
 * @returns Object with current usage, new total, and whether it exceeds limit
 */
export async function wouldExceedMonthlyLimit(
  email: string,
  firstDayOff: Date,
  lastDayOff: Date
): Promise<{
  currentUsage: MonthlyUsage
  requestedDays: number
  newTotal: number
  wouldExceed: boolean
}> {
  const currentUsage = await getMonthlyDaysUsed(email, firstDayOff)
  const requestedDays = differenceInDays(lastDayOff, firstDayOff) + 1
  const newTotal = currentUsage.totalDays + requestedDays

  return {
    currentUsage,
    requestedDays,
    newTotal,
    wouldExceed: newTotal > MONTHLY_LIMIT,
  }
}
