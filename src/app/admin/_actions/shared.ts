import { revalidatePath } from 'next/cache'
import {
  findSubmissionById,
  markPendingSubmissionMaybe,
  markSubmissionMaybe,
  recordMaybeEmailSent,
} from '@/db/submissions'
import { SubmissionStatus } from '@/db/types'
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

  const submission = await findSubmissionById(submissionId)

  if (!submission) {
    return { success: false, error: 'Submission not found' }
  }

  const now = new Date()
  const shouldSendEmail =
    submission.status === SubmissionStatus.PENDING_REVIEW && reasonConfig.sendsEmail
  const internalNote = input.internalNote?.trim() || null
  const maybeReview = {
    maybeReason: reasonConfig.value,
    maybeInternalNote: internalNote,
    maybeApprovedDays,
    reviewedByAdminId: doctorId,
    reviewedAt: now,
  }

  if (submission.status === SubmissionStatus.PENDING_REVIEW) {
    const updatedCount = await markPendingSubmissionMaybe(submissionId, maybeReview)

    if (updatedCount === 0) {
      return {
        success: false,
        error: 'This submission has already been reviewed by another doctor',
      }
    }
  } else {
    await markSubmissionMaybe(submissionId, maybeReview)
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

      await recordMaybeEmailSent(submissionId, new Date())

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
