'use server'

import { permit, transition } from '@/db/submission-lifecycle'
import { logger } from '@/lib/logger'
import { revokeNoteVerificationForSubmission } from '@/db/note-verifications'
import { adminAction } from '@/lib/admin-session'
import { denyAndRefund, errorMessage, refused, revalidate } from './shared'

const DENY_PATHS = ['/admin', '/admin/review', '/admin/maybe', '/admin/denied']

export const denySubmission = adminAction(
  async ({ doctorId }, submissionId: string, reason: string) => {
    try {
      const allowed = await permit(submissionId, 'denyManual', 'deny')
      if (!allowed.ok) return refused('deny', allowed.refusal)
      const denial = { adminId: doctorId, at: new Date(), reason }

      if (allowed.value.transition === 'denyManual') {
        const denied = await transition(allowed.value, denial)
        if (!denied.ok) return refused('deny', denied.refusal)
        await revokeNoteVerificationForSubmission(submissionId, denial.at)

        revalidate(DENY_PATHS)

        logger.info(`Manual denial completed for submission ${submissionId}`)

        return { success: true }
      }

      const result = await denyAndRefund(allowed.value, denial, {
        idempotencyKey: `refund_${submissionId}_${doctorId}`,
        processedBy: 'admin-denial-automation',
      })
      if (result.success) revalidate(DENY_PATHS)
      return result
    } catch (error) {
      logger.error('Error denying submission:', error)
      return {
        success: false,
        error: `Failed to deny submission: ${errorMessage(error)}`,
      }
    }
  }
)
