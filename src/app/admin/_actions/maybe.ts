'use server'

import { permit, transition } from '@/db/submission-lifecycle'
import { logger } from '@/lib/logger'
import { type MaybeApprovedDays, type MaybeReason } from '@/lib/maybe-reasons'
import { QUEUE_PATHS, moveSubmissionToMaybe, refused, revalidate } from './shared'
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
        transition: 'maybe',
        submissionId,
        doctorId,
        input,
        revalidatePaths: QUEUE_PATHS,
      })
    } catch (error) {
      logger.error('Error marking submission as maybe:', error)
      return { success: false, error: 'Failed to mark submission as maybe' }
    }
  }
)

export const markAsManual = adminAction(async ({ doctorId }, submissionId: string) => {
  try {
    const allowed = await permit(submissionId, 'markManual')
    if (!allowed.ok) return refused('change', allowed.refusal)

    const marked = await transition(allowed.value, { adminId: doctorId, at: new Date() })
    if (!marked.ok) return refused('change', marked.refusal)

    revalidate(QUEUE_PATHS)

    return { success: true }
  } catch (error) {
    logger.error('Error marking submission as manual:', error)
    return { success: false, error: 'Failed to mark submission as manual' }
  }
})
