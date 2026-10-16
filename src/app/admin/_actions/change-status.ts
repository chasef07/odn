'use server'

import { revalidatePath } from 'next/cache'
import {
  findSubmissionById,
  markSubmissionDenied,
  markSubmissionDeniedAndRefunded,
  markSubmissionManual,
  recordDenialEmailSent,
  returnSubmissionToReview,
} from '@/db/submissions'
import { SubmissionStatus } from '@/db/types'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { sendDenialEmail } from '@/lib/email'
import { denialSentSms } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import { revokeNoteVerificationForSubmission } from '@/db/note-verifications'
import { type MaybeSubmissionInput } from './maybe'
import { moveSubmissionToMaybe } from './shared'
import { adminAction } from '@/lib/admin-session'

export const changeSubmissionStatus = adminAction(
  async (
    { doctorId },
    submissionId: string,
    newStatus: SubmissionStatus,
    denialReason?: string,
    maybeInput?: MaybeSubmissionInput
  ): Promise<{ success: boolean; error?: string; warning?: string }> => {
    try {
      const submission = await findSubmissionById(submissionId)

      if (!submission) {
        return { success: false, error: 'Submission not found' }
      }

      const currentStatus = submission.status
      const now = new Date()

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

          if (currentStatus === SubmissionStatus.DENIED) {
            return { success: false, error: 'Submission is already denied' }
          }

          const alreadyRefunded = !!submission.stripeRefundId

          if (alreadyRefunded) {
            await markSubmissionDenied(submissionId, {
              denialReason,
              reviewedByAdminId: doctorId,
              reviewedAt: now,
              updatedAt: now,
            })
            await revokeNoteVerificationForSubmission(submissionId, now)

            let emailWarning: string | undefined
            try {
              const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
              await sendDenialEmail({
                to: submission.email,
                patientName,
                denialReason,
                refundAmount: (submission.paymentAmount ?? 0) / 100,
              })
              await recordDenialEmailSent(submissionId, new Date())
              await sendTransactionalSmsForSubmission({
                submission,
                type: 'DENIAL_SENT',
                body: denialSentSms(),
              })
            } catch {
              emailWarning = 'Status changed but email notification failed to send'
            }

            revalidatePath('/admin')
            revalidatePath('/admin/search')
            revalidatePath(`/admin/search/${submissionId}`)
            revalidatePath('/admin/denied')

            return {
              success: true,
              warning:
                emailWarning || 'Submission denied. Note: Refund was already processed previously.',
            }
          }

          if (!submission.stripePaymentIntentId) {
            return { success: false, error: 'No payment intent ID found for this submission' }
          }

          const idempotencyKey = `refund_${submissionId}_${doctorId}_change`
          let refund: Stripe.Refund

          try {
            refund = await stripe.refunds.create(
              {
                payment_intent: submission.stripePaymentIntentId,
                reason: 'requested_by_customer',
                metadata: {
                  submissionId: submission.id,
                  denialReason,
                  processedBy: 'admin-status-change',
                },
              },
              { idempotencyKey }
            )
          } catch (stripeError) {
            logger.error('Refund failed during status change:', stripeError)
            return {
              success: false,
              error: `Failed to process refund: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`,
            }
          }

          await markSubmissionDeniedAndRefunded(submissionId, {
            denialReason,
            reviewedByAdminId: doctorId,
            reviewedAt: now,
            stripeRefundId: refund.id,
            refundedAt: now,
            updatedAt: now,
          })
          await revokeNoteVerificationForSubmission(submissionId, now)

          let emailWarning: string | undefined
          try {
            const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
            const refundAmountDollars = refund.amount / 100
            await sendDenialEmail({
              to: submission.email,
              patientName,
              denialReason,
              refundAmount: refundAmountDollars,
            })
            await recordDenialEmailSent(submissionId, new Date())
            await sendTransactionalSmsForSubmission({
              submission,
              type: 'DENIAL_SENT',
              body: denialSentSms(),
            })
          } catch {
            emailWarning = 'Submission denied and refunded, but email notification failed to send'
          }

          revalidatePath('/admin')
          revalidatePath('/admin/search')
          revalidatePath(`/admin/search/${submissionId}`)
          revalidatePath('/admin/denied')

          return { success: true, warning: emailWarning }
        }

        case SubmissionStatus.MAYBE: {
          const result = await moveSubmissionToMaybe({
            submissionId,
            doctorId,
            input: maybeInput,
            revalidatePaths: [
              '/admin',
              '/admin/search',
              `/admin/search/${submissionId}`,
              '/admin/maybe',
            ],
          })
          if (result.success) {
            await revokeNoteVerificationForSubmission(submissionId, now)
          }
          return result
        }

        case SubmissionStatus.MANUAL: {
          await markSubmissionManual(submissionId, {
            reviewedByAdminId: doctorId,
            reviewedAt: now,
            updatedAt: now,
          })
          await revokeNoteVerificationForSubmission(submissionId, now)

          revalidatePath('/admin')
          revalidatePath('/admin/search')
          revalidatePath(`/admin/search/${submissionId}`)
          revalidatePath('/admin/maybe')

          return { success: true }
        }

        case SubmissionStatus.PENDING_REVIEW: {
          await returnSubmissionToReview(submissionId, now)
          await revokeNoteVerificationForSubmission(submissionId, now)

          revalidatePath('/admin')
          revalidatePath('/admin/search')
          revalidatePath(`/admin/search/${submissionId}`)
          revalidatePath('/admin/review')

          return { success: true }
        }

        default:
          return { success: false, error: `Unknown status: ${newStatus}` }
      }
    } catch (error) {
      logger.error('Error changing submission status:', error)
      return {
        success: false,
        error: `Failed to change status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }
)
