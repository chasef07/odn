'use server'

import { revalidatePath } from 'next/cache'
import {
  denyManualSubmission,
  findSubmissionForDenial,
  markSubmissionRefundReserved,
  recordDenialEmailSent,
  recordSubmissionRefund,
  releaseSubmissionRefundReservation,
} from '@/db/submissions'
import { SubmissionStatus } from '@/db/types'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { sendDenialEmail } from '@/lib/email'
import { denialSentSms } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import { revokeNoteVerificationForSubmission } from '@/db/note-verifications'
import { adminAction } from '@/lib/admin-session'

export const denySubmission = adminAction(
  async ({ doctorId }, submissionId: string, reason: string) => {
    try {
      const submission = await findSubmissionForDenial(submissionId)

      if (!submission) {
        return { success: false, error: 'Submission not found' }
      }

      if (
        submission.status !== SubmissionStatus.PENDING_REVIEW &&
        submission.status !== SubmissionStatus.MAYBE &&
        submission.status !== SubmissionStatus.MANUAL
      ) {
        return {
          success: false,
          error: `Cannot deny submission with status: ${submission.status}`,
        }
      }

      const isManual = submission.status === SubmissionStatus.MANUAL

      if (isManual) {
        const now = new Date()
        await denyManualSubmission(submissionId, {
          denialReason: reason,
          reviewedByAdminId: doctorId,
          reviewedAt: now,
        })
        await revokeNoteVerificationForSubmission(submissionId, now)

        revalidatePath('/admin')
        revalidatePath('/admin/review')
        revalidatePath('/admin/maybe')
        revalidatePath('/admin/denied')

        logger.info(`Manual denial completed for submission ${submissionId}`)

        return { success: true }
      }

      if (!submission.stripePaymentIntentId) {
        return {
          success: false,
          error: 'No payment intent ID found for this submission',
        }
      }

      if (submission.stripeRefundId) {
        return {
          success: false,
          error: 'Refund already processed for this submission',
        }
      }

      const now = new Date()
      const reservedCount = await markSubmissionRefundReserved(submissionId, {
        denialReason: reason,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
      })

      if (reservedCount === 0) {
        return {
          success: false,
          error: 'This submission has already been reviewed by another doctor',
        }
      }

      let refund: Stripe.Refund
      const idempotencyKey = `refund_${submissionId}_${doctorId}`

      try {
        refund = await stripe.refunds.create(
          {
            payment_intent: submission.stripePaymentIntentId,
            reason: 'requested_by_customer',
            metadata: {
              submissionId: submission.id,
              denialReason: reason,
              processedBy: 'admin-denial-automation',
            },
          },
          {
            idempotencyKey: idempotencyKey,
          }
        )

        logger.info(`Refund processed: ${refund.id} for submission ${submissionId}`)
      } catch (stripeError) {
        logger.error('Stripe refund failed:', stripeError)

        await releaseSubmissionRefundReservation(submissionId)

        return {
          success: false,
          error: `Failed to process refund: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`,
        }
      }

      await recordSubmissionRefund(submissionId, refund.id)
      await revokeNoteVerificationForSubmission(submissionId, now)

      const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
      const refundAmountDollars = refund.amount / 100
      let emailSentAt: Date | undefined
      let emailWarning: string | undefined

      try {
        await sendDenialEmail({
          to: submission.email,
          patientName,
          denialReason: reason,
          refundAmount: refundAmountDollars,
        })
        emailSentAt = new Date()

        await sendTransactionalSmsForSubmission({
          submission,
          type: 'DENIAL_SENT',
          body: denialSentSms(),
        })

        logger.info(`Denial email sent to ${submission.email} for submission ${submissionId}`)
      } catch (emailError) {
        logger.error('Failed to send denial email:', emailError)
        emailWarning = 'Submission denied and refunded, but email notification failed to send'
      }

      if (emailSentAt) {
        await recordDenialEmailSent(submissionId, emailSentAt)
      }

      revalidatePath('/admin')
      revalidatePath('/admin/review')
      revalidatePath('/admin/maybe')
      revalidatePath('/admin/denied')

      if (emailWarning) {
        return { success: true, warning: emailWarning }
      }

      return { success: true }
    } catch (error) {
      logger.error('Error denying submission:', error)
      return {
        success: false,
        error: `Failed to deny submission: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }
)
