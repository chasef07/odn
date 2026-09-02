import { Prisma, SubmissionStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendFollowUpEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const FOLLOW_UP_MIN_AGE_DAYS = 5
const FOLLOW_UP_MAX_AGE_DAYS = 7
const CLAIM_TIMEOUT_MS = 30 * 60 * 1000
const BATCH_SIZE = 100

export type FollowUpEmailJobResult = {
  eligible: number
  claimed: number
  sent: number
  failed: number
}

function followUpEligibilityWhere(now: Date): Prisma.SubmissionWhereInput {
  return {
    status: SubmissionStatus.APPROVED,
    approvalEmailSentAt: { not: null },
    followUpEmailSentAt: null,
    createdAt: {
      gte: new Date(now.getTime() - FOLLOW_UP_MAX_AGE_DAYS * MS_PER_DAY),
      lte: new Date(now.getTime() - FOLLOW_UP_MIN_AGE_DAYS * MS_PER_DAY),
    },
    OR: [
      { followUpEmailClaimedAt: null },
      { followUpEmailClaimedAt: { lte: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
    ],
  }
}

export async function runFollowUpEmailJob(now = new Date()): Promise<FollowUpEmailJobResult> {
  const candidates = await prisma.submission.findMany({
    where: followUpEligibilityWhere(now),
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
    select: {
      id: true,
      email: true,
      patientFirstName: true,
      patientLastName: true,
      notePurpose: true,
    },
  })

  const result: FollowUpEmailJobResult = {
    eligible: candidates.length,
    claimed: 0,
    sent: 0,
    failed: 0,
  }

  for (const submission of candidates) {
    const claim = await prisma.submission.updateMany({
      where: {
        id: submission.id,
        ...followUpEligibilityWhere(now),
      },
      data: { followUpEmailClaimedAt: now },
    })

    if (claim.count !== 1) continue
    result.claimed += 1

    try {
      await sendFollowUpEmail({
        to: submission.email,
        patientName: `${submission.patientFirstName} ${submission.patientLastName}`,
        notePurpose: submission.notePurpose,
        submissionId: submission.id,
      })
    } catch (error) {
      result.failed += 1
      await prisma.submission.updateMany({
        where: {
          id: submission.id,
          followUpEmailSentAt: null,
          followUpEmailClaimedAt: now,
        },
        data: { followUpEmailClaimedAt: null },
      })
      logger.error('Follow-up email send failed', {
        submissionId: submission.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      continue
    }

    try {
      const acknowledgement = await prisma.submission.updateMany({
        where: {
          id: submission.id,
          followUpEmailSentAt: null,
          followUpEmailClaimedAt: now,
        },
        data: {
          followUpEmailClaimedAt: null,
          followUpEmailSentAt: now,
        },
      })

      if (acknowledgement.count === 1) {
        result.sent += 1
      } else {
        result.failed += 1
        logger.error('Follow-up email sent but delivery acknowledgement was not recorded', {
          submissionId: submission.id,
        })
      }
    } catch (error) {
      result.failed += 1
      logger.error('Follow-up email sent but delivery acknowledgement failed', {
        submissionId: submission.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return result
}
