'use server'

import { SubmissionStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { sendDenialEmail } from '@/lib/email'
import { denialSentSms } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import { revokeNoteVerificationForSubmission } from '@/lib/note-verification'
import { adminAction } from '@/lib/admin-session'

export const denySubmission = adminAction(
  async ({ doctorId }, submissionId: string, reason: string) => {
    try {
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: {
          id: true,
          stripePaymentIntentId: true,
          stripeRefundId: true,
          email: true,
          phone: true,
          smsOptIn: true,
          smsPhoneE164: true,
          patientFirstName: true,
          patientLastName: true,
          status: true,
        },
      })

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
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: SubmissionStatus.DENIED,
            denialReason: reason,
            reviewedByAdminId: doctorId,
            reviewedAt: now,
            denialEmailSentAt: null,
          },
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
      const updateResult = await prisma.submission.updateMany({
        where: {
          id: submissionId,
          status: {
            in: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
          },
          stripeRefundId: null,
        },
        data: {
          status: SubmissionStatus.DENIED,
          denialReason: reason,
          reviewedByAdminId: doctorId,
          reviewedAt: now,
          stripeRefundId: `pending_${submissionId}`,
          refundedAt: now,
        },
      })

      if (updateResult.count === 0) {
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

        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: SubmissionStatus.PENDING_REVIEW,
            stripeRefundId: null,
            reviewedByAdminId: null,
            reviewedAt: null,
            refundedAt: null,
            denialReason: null,
          },
        })

        return {
          success: false,
          error: `Failed to process refund: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`,
        }
      }

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          stripeRefundId: refund.id,
        },
      })
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
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            denialEmailSentAt: emailSentAt,
          },
        })
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
