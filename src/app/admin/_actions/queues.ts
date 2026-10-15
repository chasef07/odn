'use server'

import { Prisma, SubmissionStatus } from '@prisma/client'
import { wouldExceedMonthlyLimit } from '@/lib/monthly-limit'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getBusinessDayStart } from '@/lib/admin-utils'
import { formatDateUTC } from '@/lib/utils'
import { SMS_SUPPORT_STATUS } from '@/lib/sms-support-types'
import { getCurrentDoctor } from './shared'

export type MaybeSubmission = Awaited<ReturnType<typeof getMaybeSubmissions>>['submissions'][number]

export type ManualSubmission = Awaited<
  ReturnType<typeof getManualSubmissions>
>['submissions'][number]

const DASHBOARD_COUNT_LIMIT = 1000

const DASHBOARD_TODAY_LIST_LIMIT = 250

async function getLimitedSubmissionCount(where: Prisma.SubmissionWhereInput): Promise<number> {
  try {
    const rows = await prisma.submission.findMany({
      where,
      select: { id: true },
      take: DASHBOARD_COUNT_LIMIT + 1,
    })

    return Math.min(rows.length, DASHBOARD_COUNT_LIMIT)
  } catch (error) {
    logger.error('Error fetching limited dashboard count:', error)
    return 0
  }
}

async function getLimitedSupportTicketCount(
  where: Prisma.SmsSupportTicketWhereInput
): Promise<number> {
  try {
    const rows = await prisma.smsSupportTicket.findMany({
      where,
      select: { id: true },
      take: DASHBOARD_COUNT_LIMIT + 1,
    })

    return Math.min(rows.length, DASHBOARD_COUNT_LIMIT)
  } catch (error) {
    logger.error('Error fetching limited support ticket count:', error)
    return 0
  }
}

export async function getSubmissionsForReview() {
  try {
    await getCurrentDoctor()
    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.PENDING_REVIEW,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return { success: true, data: submissions }
  } catch (error) {
    logger.error('Error fetching submissions:', error)
    return { success: false, error: 'Failed to fetch submissions' }
  }
}

export async function getDashboardStats() {
  try {
    await getCurrentDoctor()
    const today = getBusinessDayStart()
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
        reviewedAt: { gte: today },
      }),

      getLimitedSubmissionCount({
        status: SubmissionStatus.DENIED,
        reviewedAt: { gte: today },
      }),

      getLimitedSubmissionCount({ status: SubmissionStatus.MAYBE }),

      getLimitedSubmissionCount({ status: SubmissionStatus.MANUAL }),

      getLimitedSupportTicketCount({ status: SMS_SUPPORT_STATUS.NEEDS_CSR }),
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
}

export async function getApprovedSubmissionsForToday() {
  try {
    await getCurrentDoctor()
    const today = getBusinessDayStart()
    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.APPROVED,
        reviewedAt: { gte: today },
      },
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        email: true,
        approvalEmailSentAt: true,
      },
      orderBy: {
        approvalEmailSentAt: 'desc',
      },
      take: DASHBOARD_TODAY_LIST_LIMIT,
    })

    return { success: true, data: submissions }
  } catch (error) {
    logger.error('Error fetching approved submissions:', error)
    return { success: false, error: 'Failed to fetch approved submissions' }
  }
}

export async function getDeniedSubmissionsForToday() {
  try {
    await getCurrentDoctor()
    const today = getBusinessDayStart()
    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.DENIED,
        reviewedAt: { gte: today },
      },
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        email: true,
        denialEmailSentAt: true,
      },
      orderBy: {
        denialEmailSentAt: 'desc',
      },
      take: DASHBOARD_TODAY_LIST_LIMIT,
    })

    return { success: true, data: submissions }
  } catch (error) {
    logger.error('Error fetching denied submissions:', error)
    return { success: false, error: 'Failed to fetch denied submissions' }
  }
}

export async function getMonthlyLimitData(
  patientFirstName: string,
  patientLastName: string,
  patientDateOfBirth: Date,
  firstDayOff: Date,
  lastDayOff: Date
) {
  try {
    await getCurrentDoctor()
    const result = await wouldExceedMonthlyLimit(
      patientFirstName,
      patientLastName,
      patientDateOfBirth,
      firstDayOff,
      lastDayOff
    )

    return { success: true, data: result }
  } catch (error) {
    logger.error('Error getting monthly limit data:', error)
    return { success: false, error: 'Failed to calculate monthly limit' }
  }
}

export async function getMaybeSubmissions() {
  try {
    await getCurrentDoctor()

    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.MAYBE,
      },
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        email: true,
        patientDateOfBirth: true,
        recipient: true,
        guardianFirstName: true,
        guardianLastName: true,
        guardianDateOfBirth: true,
        firstDayOff: true,
        lastDayOff: true,
        maybeReason: true,
        maybeApprovedDays: true,
        maybeEmailSentAt: true,
        reviewedAt: true,
      },
      orderBy: {
        reviewedAt: 'desc',
      },
    })

    const formattedSubmissions = submissions.map((sub) => ({
      id: sub.id,
      patientFirstName: sub.patientFirstName,
      patientLastName: sub.patientLastName,
      email: sub.email,
      patientDateOfBirth: formatDateUTC(sub.patientDateOfBirth),
      recipient: sub.recipient,
      guardianFirstName: sub.guardianFirstName,
      guardianLastName: sub.guardianLastName,
      guardianDateOfBirth: sub.guardianDateOfBirth ? formatDateUTC(sub.guardianDateOfBirth) : null,
      firstDayOff: formatDateUTC(sub.firstDayOff),
      lastDayOff: formatDateUTC(sub.lastDayOff),
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
}

export async function getManualSubmissions() {
  try {
    await getCurrentDoctor()

    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.MANUAL,
      },
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        email: true,
        firstDayOff: true,
        lastDayOff: true,
        reviewedAt: true,
      },
      orderBy: {
        reviewedAt: 'desc',
      },
    })

    const formattedSubmissions = submissions.map((sub) => ({
      id: sub.id,
      patientFirstName: sub.patientFirstName,
      patientLastName: sub.patientLastName,
      email: sub.email,
      firstDayOff: formatDateUTC(sub.firstDayOff),
      lastDayOff: formatDateUTC(sub.lastDayOff),
      reviewedAt: sub.reviewedAt,
    }))

    return { success: true, submissions: formattedSubmissions }
  } catch (error) {
    logger.error('Error fetching manual submissions:', error)
    return { success: false, error: 'Failed to fetch manual submissions', submissions: [] }
  }
}
