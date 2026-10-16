import { SubmissionStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendMaybeEmail } from '@/lib/email'
import { maybeUpdateSms } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import {
  getMaybeReasonConfig,
  isMaybeApprovedDays,
  maybeReasonRequiresApprovedDays,
  type MaybeApprovedDays,
} from '@/lib/maybe-reasons'
import { type MaybeSubmissionInput } from './maybe'

export async function moveSubmissionToMaybe({
  submissionId,
  doctorId,
  input,
  revalidatePaths,
}: {
  submissionId: string
  doctorId: string
  input: MaybeSubmissionInput | undefined
  revalidatePaths: string[]
}): Promise<{ success: boolean; error?: string; warning?: string }> {
  if (!input?.reason) {
    return { success: false, error: 'Maybe reason is required' }
  }

  const reasonConfig = getMaybeReasonConfig(input.reason)
  if (!reasonConfig) {
    return { success: false, error: 'Invalid maybe reason' }
  }

  const requiresApprovedDays = maybeReasonRequiresApprovedDays(reasonConfig.value)
  const approvedDays = input.approvedDays

  if (requiresApprovedDays) {
    if (typeof approvedDays !== 'number' || !isMaybeApprovedDays(approvedDays)) {
      return {
        success: false,
        error: 'Select how many days can be approved',
      }
    }
  }
  const maybeApprovedDays = requiresApprovedDays ? (approvedDays as MaybeApprovedDays) : null

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  })

  if (!submission) {
    return { success: false, error: 'Submission not found' }
  }

  const now = new Date()
  const shouldSendEmail =
    submission.status === SubmissionStatus.PENDING_REVIEW && reasonConfig.sendsEmail
  const internalNote = input.internalNote?.trim() || null
  const maybeUpdateData = {
    status: SubmissionStatus.MAYBE,
    maybeReason: reasonConfig.value,
    maybeInternalNote: internalNote,
    maybeApprovedDays,
    maybeEmailSentAt: null,
    reviewedByAdminId: doctorId,
    reviewedAt: now,
    updatedAt: now,
  }

  if (submission.status === SubmissionStatus.PENDING_REVIEW) {
    const updateResult = await prisma.submission.updateMany({
      where: {
        id: submissionId,
        status: SubmissionStatus.PENDING_REVIEW,
      },
      data: maybeUpdateData,
    })

    if (updateResult.count === 0) {
      return {
        success: false,
        error: 'This submission has already been reviewed by another doctor',
      }
    }
  } else {
    await prisma.submission.update({
      where: { id: submissionId },
      data: maybeUpdateData,
    })
  }

  let emailWarning: string | undefined
  if (shouldSendEmail) {
    try {
      await sendMaybeEmail({
        to: submission.email,
        patientName: `${submission.patientFirstName} ${submission.patientLastName}`,
        reason: reasonConfig.value,
        approvedDays: maybeApprovedDays,
      })

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          maybeEmailSentAt: new Date(),
        },
      })

      await sendTransactionalSmsForSubmission({
        submission,
        type: 'MAYBE_UPDATE',
        body: maybeUpdateSms(),
      })
    } catch (emailError) {
      logger.error('Failed to send maybe email:', emailError)
      emailWarning = 'Submission moved to Maybe, but email notification failed to send'
    }
  }

  for (const path of revalidatePaths) {
    revalidatePath(path)
  }

  return { success: true, warning: emailWarning }
}
