import {
  acknowledgeFollowUpEmailSent,
  claimDueFollowUpEmail,
  findDueFollowUpEmails,
  releaseFollowUpEmailClaimAt,
} from '@/db/submissions'
import { sendFollowUpEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export type FollowUpEmailJobResult = {
  eligible: number
  claimed: number
  sent: number
  failed: number
}

export async function runFollowUpEmailJob(now = new Date()): Promise<FollowUpEmailJobResult> {
  const candidates = await findDueFollowUpEmails(now)

  const result: FollowUpEmailJobResult = {
    eligible: candidates.length,
    claimed: 0,
    sent: 0,
    failed: 0,
  }

  for (const submission of candidates) {
    const claimed = await claimDueFollowUpEmail(submission.id, now)

    if (claimed !== 1) continue
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
      await releaseFollowUpEmailClaimAt(submission.id, now)
      logger.error('Follow-up email send failed', {
        submissionId: submission.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      continue
    }

    try {
      const acknowledged = await acknowledgeFollowUpEmailSent(submission.id, now)

      if (acknowledged === 1) {
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
