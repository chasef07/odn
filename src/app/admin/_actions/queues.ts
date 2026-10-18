'use server'

import { wouldExceedMonthlyLimit } from '@/lib/monthly-limit'
import { findSupportTicketIdsByStatus } from '@/db/sms-support'
import {
  findManualSubmissions,
  findMaybeSubmissions,
  findSubmissionIdsByStatus,
  findSubmissionsApprovedSince,
  findSubmissionsDeniedSince,
  findSubmissionsPendingReview,
  type SubmissionStatusFilter,
} from '@/db/submissions'
import { SubmissionStatus, type SmsSupportTicket } from '@/db/types'
import { logger } from '@/lib/logger'
import { businessDayStart, dateOnlyFromUtcDate, parseDateOnly } from '@/lib/dates'
import { SMS_SUPPORT_STATUS } from '@/lib/sms-support-types'
import { adminAction } from '@/lib/admin-session'

export type MaybeSubmission = Awaited<ReturnType<typeof getMaybeSubmissions>>['submissions'][number]

export type ManualSubmission = Awaited<
  ReturnType<typeof getManualSubmissions>
>['submissions'][number]

const DASHBOARD_COUNT_LIMIT = 1000

const DASHBOARD_TODAY_LIST_LIMIT = 250

async function getLimitedSubmissionCount(filter: SubmissionStatusFilter): Promise<number> {
  const rows = await findSubmissionIdsByStatus(filter, DASHBOARD_COUNT_LIMIT + 1)
  return Math.min(rows.length, DASHBOARD_COUNT_LIMIT)
}

async function getLimitedSupportTicketCount(status: SmsSupportTicket['status']): Promise<number> {
  const rows = await findSupportTicketIdsByStatus(status, DASHBOARD_COUNT_LIMIT + 1)
  return Math.min(rows.length, DASHBOARD_COUNT_LIMIT)
}

export const getSubmissionsForReview = adminAction(async () => {
  try {
    const submissions = await findSubmissionsPendingReview()

    return { success: true, data: submissions }
  } catch (error) {
    logger.error('Error fetching submissions:', error)
    return { success: false, error: 'Failed to fetch submissions' }
  }
})

export const getDashboardStats = adminAction(async () => {
  try {
    const today = businessDayStart()
    const [
      pendingCount,
      approvedToday,
      deniedToday,
      maybeCount,
      manualCount,
      needsAdminSupportCount,
    ] = await Promise.all([
      getLimitedSubmissionCount({ status: SubmissionStatus.PENDING_REVIEW }),

      getLimitedSubmissionCount({
        status: SubmissionStatus.APPROVED,
        reviewedSince: today,
      }),

      getLimitedSubmissionCount({
        status: SubmissionStatus.DENIED,
        reviewedSince: today,
      }),

      getLimitedSubmissionCount({ status: SubmissionStatus.MAYBE }),

      getLimitedSubmissionCount({ status: SubmissionStatus.MANUAL }),

      getLimitedSupportTicketCount(SMS_SUPPORT_STATUS.NEEDS_CSR),
    ])

    return {
      success: true,
      data: {
        pendingCount,
        approvedToday,
        deniedToday,
        maybeCount,
        manualCount,
        needsAdminSupportCount,
      },
    }
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error)
    return { success: false, error: 'Failed to fetch dashboard stats' }
  }
})

export const getApprovedSubmissionsForToday = adminAction(async () => {
  try {
    const today = businessDayStart()
    const submissions = await findSubmissionsApprovedSince(today, DASHBOARD_TODAY_LIST_LIMIT)

    return { success: true, data: submissions }
  } catch (error) {
    logger.error('Error fetching approved submissions:', error)
    return { success: false, error: 'Failed to fetch approved submissions' }
  }
})

export const getDeniedSubmissionsForToday = adminAction(async () => {
  try {
    const today = businessDayStart()
    const submissions = await findSubmissionsDeniedSince(today, DASHBOARD_TODAY_LIST_LIMIT)

    return { success: true, data: submissions }
  } catch (error) {
    logger.error('Error fetching denied submissions:', error)
    return { success: false, error: 'Failed to fetch denied submissions' }
  }
})

export const getMonthlyLimitData = adminAction(
  async (
    _admin,
    patientFirstName: string,
    patientLastName: string,
    patientDateOfBirth: string,
    firstDayOff: string,
    lastDayOff: string
  ) => {
    const dateOfBirth = parseDateOnly(patientDateOfBirth)
    const firstDay = parseDateOnly(firstDayOff)
    const lastDay = parseDateOnly(lastDayOff)
    if (!dateOfBirth || !firstDay || !lastDay) {
      return { success: false, error: 'Expected YYYY-MM-DD dates' }
    }
    try {
      const result = await wouldExceedMonthlyLimit(
        patientFirstName,
        patientLastName,
        dateOfBirth,
        firstDay,
        lastDay
      )

      return { success: true, data: result }
    } catch (error) {
      logger.error('Error getting monthly limit data:', error)
      return { success: false, error: 'Failed to calculate monthly limit' }
    }
  }
)

export const getMaybeSubmissions = adminAction(async () => {
  try {
    const submissions = await findMaybeSubmissions()

    const formattedSubmissions = submissions.map((sub) => ({
      id: sub.id,
      patientFirstName: sub.patientFirstName,
      patientLastName: sub.patientLastName,
      email: sub.email,
      patientDateOfBirth: dateOnlyFromUtcDate(sub.patientDateOfBirth),
      recipient: sub.recipient,
      guardianFirstName: sub.guardianFirstName,
      guardianLastName: sub.guardianLastName,
      guardianDateOfBirth: sub.guardianDateOfBirth
        ? dateOnlyFromUtcDate(sub.guardianDateOfBirth)
        : null,
      firstDayOff: dateOnlyFromUtcDate(sub.firstDayOff),
      lastDayOff: dateOnlyFromUtcDate(sub.lastDayOff),
      maybeReason: sub.maybeReason,
      maybeApprovedDays: sub.maybeApprovedDays,
      maybeEmailSentAt: sub.maybeEmailSentAt,
      reviewedAt: sub.reviewedAt,
    }))

    return { success: true, submissions: formattedSubmissions }
  } catch (error) {
    logger.error('Error fetching maybe submissions:', error)
    return { success: false, error: 'Failed to fetch maybe submissions', submissions: [] }
  }
})

export const getManualSubmissions = adminAction(async () => {
  try {
    const submissions = await findManualSubmissions()

    const formattedSubmissions = submissions.map((sub) => ({
      id: sub.id,
      patientFirstName: sub.patientFirstName,
      patientLastName: sub.patientLastName,
      email: sub.email,
      firstDayOff: dateOnlyFromUtcDate(sub.firstDayOff),
      lastDayOff: dateOnlyFromUtcDate(sub.lastDayOff),
      reviewedAt: sub.reviewedAt,
    }))

    return { success: true, submissions: formattedSubmissions }
  } catch (error) {
    logger.error('Error fetching manual submissions:', error)
    return { success: false, error: 'Failed to fetch manual submissions', submissions: [] }
  }
})
