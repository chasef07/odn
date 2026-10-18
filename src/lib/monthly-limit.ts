import { findApprovedSubmissionsOverlapping } from '@/db/submissions'
import {
  addDays,
  dateOnlyFromUtcDate,
  inclusiveDayCount,
  utcDateFromDateOnly,
  type DateOnly,
} from '@/lib/dates'

export interface MonthlyUsage {
  totalDays: number
  submissions: Array<{
    id: string
    firstDayOff: DateOnly
    lastDayOff: DateOnly
    days: number
    approvedAt: Date | null
  }>
  exceedsLimit: boolean
  remainingDays: number
}

const ROLLING_LIMIT = 7
const WINDOW_DAYS = 30

export async function getMonthlyDaysUsed(
  patientFirstName: string,
  patientLastName: string,
  patientDateOfBirth: DateOnly,
  referenceDay: DateOnly
): Promise<MonthlyUsage> {
  const submissions = await findApprovedSubmissionsOverlapping(
    {
      patientFirstName,
      patientLastName,
      patientDateOfBirth: utcDateFromDateOnly(patientDateOfBirth),
    },
    {
      windowStart: utcDateFromDateOnly(addDays(referenceDay, -WINDOW_DAYS)),
      windowEnd: utcDateFromDateOnly(addDays(referenceDay, -1)),
    }
  )

  const submissionsWithDays = submissions.map((sub) => {
    const firstDayOff = dateOnlyFromUtcDate(sub.firstDayOff)
    const lastDayOff = dateOnlyFromUtcDate(sub.lastDayOff)
    return {
      id: sub.id,
      firstDayOff,
      lastDayOff,
      days: inclusiveDayCount(firstDayOff, lastDayOff),
      approvedAt: sub.reviewedAt,
    }
  })

  const totalDays = submissionsWithDays.reduce((sum, sub) => sum + sub.days, 0)

  return {
    totalDays,
    submissions: submissionsWithDays,
    exceedsLimit: totalDays > ROLLING_LIMIT,
    remainingDays: Math.max(0, ROLLING_LIMIT - totalDays),
  }
}

export async function wouldExceedMonthlyLimit(
  patientFirstName: string,
  patientLastName: string,
  patientDateOfBirth: DateOnly,
  firstDayOff: DateOnly,
  lastDayOff: DateOnly
): Promise<{
  currentUsage: MonthlyUsage
  requestedDays: number
  newTotal: number
  wouldExceed: boolean
}> {
  const currentUsage = await getMonthlyDaysUsed(
    patientFirstName,
    patientLastName,
    patientDateOfBirth,
    firstDayOff
  )
  const requestedDays = inclusiveDayCount(firstDayOff, lastDayOff)
  const newTotal = currentUsage.totalDays + requestedDays

  return {
    currentUsage,
    requestedDays,
    newTotal,
    wouldExceed: newTotal > ROLLING_LIMIT,
  }
}
