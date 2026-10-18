'use server'

import { permit, transition } from '@/db/submission-lifecycle'
import { SubmissionStatus } from '@/db/types'
import { logger } from '@/lib/logger'
import { revokeNoteVerificationForSubmission } from '@/db/note-verifications'
import { type MaybeSubmissionInput } from './maybe'
import {
  denyAndRefund,
  errorMessage,
  moveSubmissionToMaybe,
  notifyDenial,
  refused,
  revalidate,
  type ActionResult,
} from './shared'
import { adminAction } from '@/lib/admin-session'

export const changeSubmissionStatus = adminAction(
  async (
    { doctorId },
    submissionId: string,
    newStatus: SubmissionStatus,
    denialReason?: string,
    maybeInput?: MaybeSubmissionInput
  ): Promise<ActionResult> => {
    try {
      const now = new Date()
      const detailPaths = ['/admin', '/admin/search', `/admin/search/${submissionId}`]

      switch (newStatus) {
        case SubmissionStatus.APPROVED: {
          return {
            success: false,
            error: 'Use approveSubmission or reApproveSubmission for approvals',
          }
        }

        case SubmissionStatus.DENIED: {
          if (!denialReason) {
            return { success: false, error: 'Denial reason is required' }
          }

          const allowed = await permit(submissionId, 'overrideDenyRefunded', 'overrideDeny')
          if (!allowed.ok) return refused('deny', allowed.refusal)
          const denial = { adminId: doctorId, at: now, reason: denialReason }
          const paths = [...detailPaths, '/admin/denied']

          if (allowed.value.transition === 'overrideDeny') {
            const result = await denyAndRefund(allowed.value, denial, {
              idempotencyKey: `refund_${submissionId}_${doctorId}_change`,
              processedBy: 'admin-status-change',
            })
            if (result.success) revalidate(paths)
            return result
          }

          const denied = await transition(allowed.value, denial)
          if (!denied.ok) return refused('deny', denied.refusal)
          await revokeNoteVerificationForSubmission(submissionId, now)

          const notified = await notifyDenial(
            denied.value,
            denialReason,
            denied.value.paymentAmount ?? 0,
            'Status changed but email notification failed to send'
          )

          revalidate(paths)

          return {
            success: true,
            warning:
              notified.warning ||
              'Submission denied. Note: Refund was already processed previously.',
          }
        }

        case SubmissionStatus.MAYBE: {
          const result = await moveSubmissionToMaybe({
            transition: 'overrideMaybe',
            submissionId,
            doctorId,
            input: maybeInput,
            revalidatePaths: [...detailPaths, '/admin/maybe'],
          })
          if (result.success) {
            await revokeNoteVerificationForSubmission(submissionId, now)
          }
          return result
        }

        case SubmissionStatus.MANUAL: {
          const allowed = await permit(submissionId, 'overrideManual')
          if (!allowed.ok) return refused('change', allowed.refusal)
          const marked = await transition(allowed.value, { adminId: doctorId, at: now })
          if (!marked.ok) return refused('change', marked.refusal)
          await revokeNoteVerificationForSubmission(submissionId, now)

          revalidate([...detailPaths, '/admin/maybe'])

          return { success: true }
        }

        case SubmissionStatus.PENDING_REVIEW: {
          const allowed = await permit(submissionId, 'reopen')
          if (!allowed.ok) return refused('change', allowed.refusal)
          const reopened = await transition(allowed.value, { at: now })
          if (!reopened.ok) return refused('change', reopened.refusal)
          await revokeNoteVerificationForSubmission(submissionId, now)

          revalidate([...detailPaths, '/admin/review'])

          return { success: true }
        }

        default:
          return { success: false, error: `Unknown status: ${newStatus}` }
      }
    } catch (error) {
      logger.error('Error changing submission status:', error)
      return {
        success: false,
        error: `Failed to change status: ${errorMessage(error)}`,
      }
    }
  }
)
