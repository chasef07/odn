'use server'

import { permit, transition } from '@/db/submission-lifecycle'
import { logger } from '@/lib/logger'
import { revokeNoteVerificationForSubmission } from '@/db/note-verifications'
import { adminAction } from '@/lib/admin-session'
import {
  QUEUE_PATHS,
  denyAndRefund,
  errorMessage,
  notifyDenial,
  refused,
  revalidate,
} from './shared'

const DENY_PATHS = [...QUEUE_PATHS, '/admin/denied']

export const denySubmission = adminAction(
  async ({ doctorId }, submissionId: string, reason: string) => {
    try {
      const allowed = await permit(submissionId, 'denyManual', 'denyRefunded', 'deny')
      if (!allowed.ok) return refused('deny', allowed.refusal)
      const denial = { adminId: doctorId, at: new Date(), reason }

      if (allowed.value.transition !== 'deny') {
        const denied = await transition(allowed.value, denial)
        if (!denied.ok) return refused('deny', denied.refusal)
        await revokeNoteVerificationForSubmission(submissionId, denial.at)
        const result =
          allowed.value.transition === 'denyRefunded'
            ? await notifyDenial(denied.value, reason, denied.value.paymentAmount ?? 0)
            : { success: true }

        revalidate(DENY_PATHS)

        return result
      }

      const result = await denyAndRefund(allowed.value, denial, 'admin-denial-automation')
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
