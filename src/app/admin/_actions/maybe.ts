'use server'

import { revalidatePath } from 'next/cache'
import { findSubmissionStatus, markMaybeSubmissionManual } from '@/db/submissions'
import { SubmissionStatus } from '@/db/types'
import { logger } from '@/lib/logger'
import { type MaybeApprovedDays, type MaybeReason } from '@/lib/maybe-reasons'
import { moveSubmissionToMaybe } from './shared'
import { adminAction } from '@/lib/admin-session'

export type MaybeSubmissionInput = {
  reason: MaybeReason | string
  internalNote?: string
  approvedDays?: MaybeApprovedDays | number
}

export const maybeSubmission = adminAction(
  async ({ doctorId }, submissionId: string, input: MaybeSubmissionInput) => {
    try {
      return await moveSubmissionToMaybe({
        submissionId,
        doctorId,
        input,
        revalidatePaths: ['/admin', '/admin/review', '/admin/maybe'],
      })
    } catch (error) {
      logger.error('Error marking submission as maybe:', error)
      return { success: false, error: 'Failed to mark submission as maybe' }
    }
  }
)

export const markAsManual = adminAction(async ({ doctorId }, submissionId: string) => {
  try {
    const submission = await findSubmissionStatus(submissionId)

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    if (submission.status !== SubmissionStatus.MAYBE) {
      return {
        success: false,
        error: `Can only mark MAYBE submissions as manual, current status: ${submission.status}`,
      }
    }

    await markMaybeSubmissionManual(submissionId, {
      reviewedByAdminId: doctorId,
      reviewedAt: new Date(),
    })

    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')

    return { success: true }
  } catch (error) {
    logger.error('Error marking submission as manual:', error)
    return { success: false, error: 'Failed to mark submission as manual' }
  }
})
