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
import { findSubmissionById, recordDenialEmailSent, recordMaybeEmailSent } from '@/db/submissions'
import { revokeNoteVerificationForSubmission } from '@/db/note-verifications'
import {
  permit,
  refundState,
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

export const QUEUE_PATHS = ['/admin', '/admin/review', '/admin/maybe']

export type RefundOrigin = 'admin-denial-automation' | 'admin-status-change'

const IDEMPOTENCY_SUFFIX: Record<RefundOrigin, string> = {
  'admin-denial-automation': '',
  'admin-status-change': '_change',
}

export async function denyAndRefund(
  allowed: Permit<'deny' | 'overrideDeny'>,
  denial: Denial,
  processedBy: RefundOrigin
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
        metadata: { submissionId: prior.id, denialReason: denial.reason, processedBy },
      },
      {
        idempotencyKey: `refund_${prior.id}_${denial.adminId}${IDEMPOTENCY_SUFFIX[processedBy]}`,
      }
    )
  } catch (stripeError) {
    logger.error('Stripe refund failed:', stripeError)
    const failure = `Failed to process refund: ${errorMessage(stripeError)}`
    if (!refundCertainlyFailed(stripeError)) {
      return {
        success: false,
        error: `${failure}. The refund outcome is unknown, so the submission stays denied with its refund pending.`,
      }
    }
    const released = await transition(
      { transition: 'releaseRefund', row: reserved.value },
      { at: new Date(), prior }
    ).catch((releaseError: unknown) => {
      logger.error('Refund reservation could not be released:', releaseError)
      return null
    })
    if (!released?.ok) {
      if (released) logger.error('Refund reservation found a moved row:', released.refusal)
      return { success: false, error: `${failure}. The refund reservation could not be released.` }
    }
    return { success: false, error: failure }
  }

  return finishRefundedDenial(reserved.value, refund, denial.reason, denial.at)
}

export async function finishRefundedDenial(
  reserved: Submission,
  refund: Pick<Stripe.Refund, 'id' | 'amount'>,
  reason: string,
  at: Date
): Promise<ActionResult> {
  const recorded = await transition(
    { transition: 'recordRefund', row: reserved },
    { at, stripeRefundId: refund.id }
  ).catch((recordError: unknown) => {
    logger.error(`Stripe refund ${refund.id} could not be recorded:`, recordError)
    return null
  })
  if (!recorded?.ok) {
    if (recorded) logger.error(`Stripe refund ${refund.id} found a moved row:`, recorded.refusal)
    return { success: false, error: `Refund ${refund.id} was issued but could not be recorded.` }
  }

  await revokeNoteVerificationForSubmission(reserved.id, at)
  return notifyDenial(recorded.value, reason, refund.amount)
}

const REFUND_NEVER_PAID = new Set(['failed', 'canceled'])

export type RefundSettlement =
  | { settled: 'recorded'; refundId: string; notice: ActionResult }
  | { settled: 'released'; status: SubmissionStatus }

export async function settleRefundReservation(
  id: string,
  releaseTo: string | undefined
): Promise<RefundSettlement> {
  const row = await findSubmissionById(id)
  if (!row) throw new Error(`submission ${id} not found`)
  if (refundState(row.stripeRefundId) !== 'reserved') {
    throw new Error(`submission ${id} holds no refund reservation (${row.stripeRefundId})`)
  }

  const { data: refunds } = await stripe.refunds.list({
    payment_intent: row.stripePaymentIntentId,
    limit: 100,
  })
  const refund = refunds.find((candidate) => !REFUND_NEVER_PAID.has(candidate.status ?? ''))
  const at = new Date()

  if (refund) {
    if (row.denialReason === null) {
      throw new Error(`submission ${id} is reserved without a denial reason`)
    }
    const notice = await finishRefundedDenial(row, refund, row.denialReason, at)
    if (!notice.success) throw new Error(notice.error)
    return { settled: 'recorded', refundId: refund.id, notice }
  }

  if (refunds.length > 0) {
    const listed = refunds.map((candidate) => `${candidate.id} ${candidate.status}`).join(', ')
    throw new Error(
      `Stripe lists only failed or canceled refunds for ${row.stripePaymentIntentId} (${listed}); resolve them in Stripe before releasing the reservation`
    )
  }

  if (!releaseTo) {
    throw new Error(
      `Stripe holds no refund for ${row.stripePaymentIntentId}; rerun with --release-to <${Object.values(SubmissionStatus).join('|')}> to release the reservation`
    )
  }
  const status = Object.values(SubmissionStatus).find((candidate) => candidate === releaseTo)
  if (!status) throw new Error(`${releaseTo} is not a submission status`)
  const released = await transition(
    { transition: 'releaseRefund', row },
    {
      at,
      prior: {
        ...row,
        status,
        stripeRefundId: null,
        denialReason: null,
        reviewedByAdminId: null,
        reviewedAt: null,
      },
    }
  )
  if (!released.ok) throw new Error(`release refused: ${released.refusal.reason}`)
  return { settled: 'released', status }
}

function refundCertainlyFailed(error: unknown): boolean {
  if (!(error instanceof Error) || !('type' in error)) return false
  if (error.type === 'StripeCardError') return true
  const alreadyRefunded = 'code' in error && error.code === 'charge_already_refunded'
  return error.type === 'StripeInvalidRequestError' && !alreadyRefunded
}

export async function notifyDenial(
  submission: Submission,
  reason: string,
  refundCents: number
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
    return { success: true }
  } catch (emailError) {
    logger.error('Failed to send denial email:', emailError)
    return { success: true, warning: 'Submission denied, but email notification failed to send' }
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
