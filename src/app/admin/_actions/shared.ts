import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { sendDenialEmail, sendMaybeEmail } from '@/lib/email'
import { denialSentSms, maybeUpdateSms } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import {
  getMaybeReasonConfig,
  isMaybeApprovedDays,
  maybeReasonRequiresApprovedDays,
  type MaybeApprovedDays,
} from '@/lib/maybe-reasons'
import { recordDenialEmailSent, recordMaybeEmailSent } from '@/db/submissions'
import { revokeNoteVerificationForSubmission } from '@/db/note-verifications'
import {
  permit,
  transition,
  type Denial,
  type Permit,
  type Refusal,
} from '@/db/submission-lifecycle'
import { SubmissionStatus, type Submission } from '@/db/types'
import { type MaybeSubmissionInput } from './maybe'

export type ActionResult = { success: boolean; error?: string; warning?: string }

export type Verb = 'approve' | 're-approve' | 'deny' | 'change'

const REFUND_MESSAGES = {
  none: 'No refund is pending for this submission',
  reserved: 'A refund is in progress for this submission',
  refunded: 'Refund already processed for this submission',
}

export function refusalMessage(verb: Verb, refusal: Refusal): string {
  switch (refusal.reason) {
    case 'missing':
      return 'Submission not found'
    case 'status':
      return `Cannot ${verb} submission with status: ${refusal.status}`
    case 'refund':
      return REFUND_MESSAGES[refusal.refund]
    case 'stale':
      return 'Submission was already updated. Please refresh and try again.'
  }
}

export function refused(verb: Verb, refusal: Refusal): ActionResult {
  return { success: false, error: refusalMessage(verb, refusal) }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

export function revalidate(paths: readonly string[]): void {
  for (const path of paths) revalidatePath(path)
}

export type RefundOrigin = {
  idempotencyKey: string
  processedBy: 'admin-denial-automation' | 'admin-status-change'
}

export async function denyAndRefund(
  allowed: Permit<'deny' | 'overrideDeny'>,
  denial: Denial,
  origin: RefundOrigin
): Promise<ActionResult> {
  const prior = allowed.row
  const reserved = await transition(allowed, denial)
  if (!reserved.ok) return refused('deny', reserved.refusal)

  let refund: Stripe.Refund
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: prior.stripePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          submissionId: prior.id,
          denialReason: denial.reason,
          processedBy: origin.processedBy,
        },
      },
      { idempotencyKey: origin.idempotencyKey }
    )
  } catch (stripeError) {
    logger.error('Stripe refund failed:', stripeError)
    const released = await transition(
      { transition: 'releaseRefund', row: reserved.value },
      { at: new Date(), prior }
    )
    if (!released.ok) logger.error('Refund reservation was not released:', released.refusal)
    return { success: false, error: `Failed to process refund: ${errorMessage(stripeError)}` }
  }

  const recorded = await transition(
    { transition: 'recordRefund', row: reserved.value },
    { at: new Date(), stripeRefundId: refund.id }
  ).catch((recordError: unknown) => {
    logger.error(`Stripe refund ${refund.id} could not be recorded:`, recordError)
    return null
  })
  if (!recorded?.ok) {
    if (recorded) logger.error(`Stripe refund ${refund.id} found a moved row:`, recorded.refusal)
    return {
      success: false,
      error: `Refund ${refund.id} was issued but could not be recorded. Do not retry; contact engineering.`,
    }
  }

  logger.info(`Refund processed: ${refund.id} for submission ${prior.id}`)
  await revokeNoteVerificationForSubmission(prior.id, denial.at)
  return notifyDenial(
    recorded.value,
    denial.reason,
    refund.amount,
    'Submission denied and refunded, but email notification failed to send'
  )
}

export async function notifyDenial(
  submission: Submission,
  reason: string,
  refundCents: number,
  emailFailure: string
): Promise<ActionResult> {
  try {
    await sendDenialEmail({
      to: submission.email,
      patientName: `${submission.patientFirstName} ${submission.patientLastName}`,
      denialReason: reason,
      refundAmount: refundCents / 100,
    })
    await recordDenialEmailSent(submission.id, new Date())
    await sendTransactionalSmsForSubmission({
      submission,
      type: 'DENIAL_SENT',
      body: denialSentSms(),
    })
    logger.info(`Denial email sent to ${submission.email} for submission ${submission.id}`)
    return { success: true }
  } catch (emailError) {
    logger.error('Failed to send denial email:', emailError)
    return { success: true, warning: emailFailure }
  }
}

export async function moveSubmissionToMaybe({
  transition: name,
  submissionId,
  doctorId,
  input,
  revalidatePaths,
}: {
  transition: 'maybe' | 'overrideMaybe'
  submissionId: string
  doctorId: string
  input: MaybeSubmissionInput | undefined
  revalidatePaths: string[]
}): Promise<ActionResult> {
  if (!input?.reason) {
    return { success: false, error: 'Maybe reason is required' }
  }

  const reasonConfig = getMaybeReasonConfig(input.reason)
  if (!reasonConfig) {
    return { success: false, error: 'Invalid maybe reason' }
  }

  let maybeApprovedDays: MaybeApprovedDays | null = null
  if (maybeReasonRequiresApprovedDays(reasonConfig.value)) {
    if (typeof input.approvedDays !== 'number' || !isMaybeApprovedDays(input.approvedDays)) {
      return { success: false, error: 'Select how many days can be approved' }
    }
    maybeApprovedDays = input.approvedDays
  }

  const allowed = await permit(submissionId, name)
  if (!allowed.ok) return refused('change', allowed.refusal)
  const submission = allowed.value.row
  const shouldSendEmail =
    submission.status === SubmissionStatus.PENDING_REVIEW && reasonConfig.sendsEmail

  const moved = await transition(allowed.value, {
    adminId: doctorId,
    at: new Date(),
    reason: reasonConfig.value,
    internalNote: input.internalNote?.trim() || null,
    approvedDays: maybeApprovedDays,
  })
  if (!moved.ok) return refused('change', moved.refusal)

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
        submission: moved.value,
        type: 'MAYBE_UPDATE',
        body: maybeUpdateSms(),
      })
    } catch (emailError) {
      logger.error('Failed to send maybe email:', emailError)
      emailWarning = 'Submission moved to Maybe, but email notification failed to send'
    }
  }

  revalidate(revalidatePaths)

  return { success: true, warning: emailWarning }
}
