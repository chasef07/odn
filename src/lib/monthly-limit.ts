import { subDays, differenceInDays, startOfDay } from 'date-fns'
import { findApprovedSubmissionsOverlapping } from '@/db/submissions'

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

const ROLLING_LIMIT = 7
const WINDOW_DAYS = 30

export async function getMonthlyDaysUsed(
  patientFirstName: string,
  patientLastName: string,
  patientDateOfBirth: Date,
  referenceDate: Date
): Promise<MonthlyUsage> {
  const normalizedReference = startOfDay(referenceDate)

  const windowStart = subDays(normalizedReference, WINDOW_DAYS)
  const windowEnd = subDays(normalizedReference, 1)

  const submissions = await findApprovedSubmissionsOverlapping(
    { patientFirstName, patientLastName, patientDateOfBirth },
    { windowStart, windowEnd }
  )

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
  patientDateOfBirth: Date,
  firstDayOff: Date,
  lastDayOff: Date
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
  const requestedDays = differenceInDays(lastDayOff, firstDayOff) + 1
  const newTotal = currentUsage.totalDays + requestedDays

  return {
    currentUsage,
    requestedDays,
    newTotal,
    wouldExceed: newTotal > ROLLING_LIMIT,
  }
}
