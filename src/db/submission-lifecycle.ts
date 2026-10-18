import { db } from './pool'
import { and, sql, type Sql } from './sql'
import { selectAll, set, type Patch } from './table'
import { submissions } from './tables'
import { findSubmissionById } from './submissions'
import { SubmissionStatus, type Submission } from './types'

export type RefundState = 'none' | 'reserved' | 'refunded'

const RESERVED_PREFIX = 'pending_'

export function refundState(stripeRefundId: string | null): RefundState {
  if (stripeRefundId === null) return 'none'
  return stripeRefundId.startsWith(RESERVED_PREFIX) ? 'reserved' : 'refunded'
}

export type Review = { adminId: string; at: Date }
export type Approval = Review & { diagnosis: string | null; withRestrictions: boolean }
export type Denial = Review & { reason: string }
export type MaybeReview = Review & {
  reason: string
  internalNote: string | null
  approvedDays: number | null
}
export type Reopening = { at: Date }
export type RefundRecord = { at: Date; stripeRefundId: string }
export type RefundRelease = { at: Date; prior: Submission }

type Stamped = { at: Date }

const guarded = ['status', 'stripeRefundId'] as const
type GuardKey = (typeof guarded)[number]
type Guarded = Pick<Submission, GuardKey>

type OwnedColumn =
  | 'reviewedAt'
  | 'reviewedByAdminId'
  | 'denialReason'
  | 'maybeReason'
  | 'maybeInternalNote'
  | 'maybeApprovedDays'
  | 'maybeEmailSentAt'
  | 'stripeRefundId'
  | 'refundedAt'
  | 'approvalEmailSentAt'
  | 'denialEmailSentAt'
  | 'approvalDiagnosis'
  | 'approvalWithRestrictions'

type Next = Patch<Pick<Submission, OwnedColumn>> & Pick<Submission, 'status'>

type Reservation = Pick<
  Submission,
  'status' | 'denialReason' | 'reviewedByAdminId' | 'reviewedAt' | 'stripeRefundId'
>

type Entry<I extends Stamped> = {
  readonly from: readonly SubmissionStatus[]
  readonly refund: RefundState
  readonly write: (input: I, read: Submission) => Next
}

function entry<I extends Stamped>(spec: Entry<I>): Entry<I> {
  return spec
}

function approved(approval: Approval): Next {
  return {
    status: SubmissionStatus.APPROVED,
    reviewedByAdminId: approval.adminId,
    reviewedAt: approval.at,
    denialReason: null,
    approvalDiagnosis: approval.diagnosis,
    approvalWithRestrictions: approval.withRestrictions,
  }
}

function approvedManually(review: Review): Next {
  return {
    status: SubmissionStatus.APPROVED,
    reviewedByAdminId: review.adminId,
    reviewedAt: review.at,
    denialReason: null,
    approvalEmailSentAt: null,
    approvalDiagnosis: null,
    approvalWithRestrictions: null,
  }
}

function reserved(denial: Denial, read: Submission): Reservation {
  return {
    status: SubmissionStatus.DENIED,
    denialReason: denial.reason,
    reviewedByAdminId: denial.adminId,
    reviewedAt: denial.at,
    stripeRefundId: `${RESERVED_PREFIX}${read.id}`,
  }
}

function released({ prior }: RefundRelease, read: Submission): Reservation {
  if (prior.id !== read.id || refundState(prior.stripeRefundId) !== 'none') {
    throw new Error(`release of ${read.id} needs the row read before its reservation`)
  }
  return {
    status: prior.status,
    denialReason: prior.denialReason,
    reviewedByAdminId: prior.reviewedByAdminId,
    reviewedAt: prior.reviewedAt,
    stripeRefundId: null,
  }
}

function recorded(record: RefundRecord): Next {
  if (refundState(record.stripeRefundId) !== 'refunded') {
    throw new Error(`${record.stripeRefundId} is not a Stripe refund id`)
  }
  return {
    status: SubmissionStatus.DENIED,
    stripeRefundId: record.stripeRefundId,
    refundedAt: record.at,
  }
}

function denied(denial: Denial): Next {
  return {
    status: SubmissionStatus.DENIED,
    denialReason: denial.reason,
    reviewedByAdminId: denial.adminId,
    reviewedAt: denial.at,
  }
}

function deniedManually(denial: Denial): Next {
  return { ...denied(denial), denialEmailSentAt: null }
}

function maybe(review: MaybeReview): Next {
  return {
    status: SubmissionStatus.MAYBE,
    maybeReason: review.reason,
    maybeInternalNote: review.internalNote,
    maybeApprovedDays: review.approvedDays,
    maybeEmailSentAt: null,
    reviewedByAdminId: review.adminId,
    reviewedAt: review.at,
  }
}

function manual(review: Review): Next {
  return {
    status: SubmissionStatus.MANUAL,
    reviewedByAdminId: review.adminId,
    reviewedAt: review.at,
  }
}

function reopened(): Next {
  return { status: SubmissionStatus.PENDING_REVIEW, reviewedByAdminId: null, reviewedAt: null }
}

const entries = {
  approve: entry<Approval>({
    from: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
    refund: 'none',
    write: approved,
  }),
  approveManual: entry<Review>({
    from: [SubmissionStatus.MANUAL],
    refund: 'none',
    write: approvedManually,
  }),
  reapprove: entry<Approval>({
    from: [SubmissionStatus.APPROVED],
    refund: 'none',
    write: approved,
  }),
  deny: entry<Denial>({
    from: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
    refund: 'none',
    write: reserved,
  }),
  denyManual: entry<Denial>({
    from: [SubmissionStatus.MANUAL],
    refund: 'none',
    write: deniedManually,
  }),
  overrideDeny: entry<Denial>({
    from: [
      SubmissionStatus.PENDING_REVIEW,
      SubmissionStatus.MAYBE,
      SubmissionStatus.MANUAL,
      SubmissionStatus.APPROVED,
    ],
    refund: 'none',
    write: reserved,
  }),
  overrideDenyRefunded: entry<Denial>({
    from: [
      SubmissionStatus.PENDING_REVIEW,
      SubmissionStatus.MAYBE,
      SubmissionStatus.MANUAL,
      SubmissionStatus.APPROVED,
    ],
    refund: 'refunded',
    write: denied,
  }),
  maybe: entry<MaybeReview>({
    from: [SubmissionStatus.PENDING_REVIEW],
    refund: 'none',
    write: maybe,
  }),
  overrideMaybe: entry<MaybeReview>({
    from: [
      SubmissionStatus.PENDING_REVIEW,
      SubmissionStatus.MANUAL,
      SubmissionStatus.APPROVED,
      SubmissionStatus.DENIED,
    ],
    refund: 'none',
    write: maybe,
  }),
  markManual: entry<Review>({
    from: [SubmissionStatus.MAYBE],
    refund: 'none',
    write: manual,
  }),
  overrideManual: entry<Review>({
    from: [
      SubmissionStatus.PENDING_REVIEW,
      SubmissionStatus.MAYBE,
      SubmissionStatus.APPROVED,
      SubmissionStatus.DENIED,
    ],
    refund: 'none',
    write: manual,
  }),
  reopen: entry<Reopening>({
    from: [
      SubmissionStatus.MAYBE,
      SubmissionStatus.MANUAL,
      SubmissionStatus.APPROVED,
      SubmissionStatus.DENIED,
    ],
    refund: 'none',
    write: reopened,
  }),
  recordRefund: entry<RefundRecord>({
    from: [SubmissionStatus.DENIED],
    refund: 'reserved',
    write: recorded,
  }),
  releaseRefund: entry<RefundRelease>({
    from: [SubmissionStatus.DENIED],
    refund: 'reserved',
    write: released,
  }),
}

export type Transition = keyof typeof entries
export type Settlement = 'recordRefund' | 'releaseRefund'
export type Decision = Exclude<Transition, Settlement>

type Inputs = { [K in Transition]: (typeof entries)[K] extends Entry<infer I> ? I : never }

const lifecycle: { [K in Transition]: Entry<Inputs[K]> } = entries

export type Refusal =
  | { readonly reason: 'missing' }
  | { readonly reason: 'status'; readonly status: SubmissionStatus }
  | { readonly reason: 'refund'; readonly refund: RefundState }
  | { readonly reason: 'stale' }

export type Outcome<V> =
  | { readonly ok: true; readonly value: V }
  | { readonly ok: false; readonly refusal: Refusal }

type Step<K extends Transition> = { readonly transition: K; readonly row: Submission }

export type Permit<K extends Transition = Transition> = { [P in K]: Step<P> }[K]

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I
) => void
  ? I
  : never

type SharedInput<K extends Transition> = [Inputs[K]] extends [UnionToIntersection<Inputs[K]>]
  ? unknown
  : never

function refuse(refusal: Refusal): { ok: false; refusal: Refusal } {
  return { ok: false, refusal }
}

function mismatch(
  rule: Pick<Entry<never>, 'from' | 'refund'>,
  read: Guarded
): Extract<Refusal, { reason: 'status' | 'refund' }> | null {
  if (!rule.from.includes(read.status)) return { reason: 'status', status: read.status }
  const refund = refundState(read.stripeRefundId)
  if (refund !== rule.refund) return { reason: 'refund', refund }
  return null
}

function versioned(read: Guarded, next: Next): boolean {
  return guarded.every((key) => (next[key] === undefined ? read[key] : next[key]) === read[key])
}

function pinned(read: Guarded): Record<GuardKey, Sql> {
  return {
    status: sql`status = ${read.status}`,
    stripeRefundId:
      read.stripeRefundId === null
        ? sql`stripe_refund_id IS NULL`
        : sql`stripe_refund_id = ${read.stripeRefundId}`,
  }
}

async function guardedUpdate(read: Submission, next: Next, at: Date): Promise<Submission | null> {
  return db.one(
    sql`UPDATE submissions SET ${set(submissions, { ...next, updatedAt: at })} WHERE ${and(
      sql`id = ${read.id}`,
      ...Object.values(pinned(read)),
      versioned(read, next) && sql`updated_at = ${read.updatedAt}`
    )} RETURNING ${selectAll(submissions)}`
  )
}

export async function permit<N extends Decision>(
  id: string,
  ...names: [N, ...N[]]
): Promise<Outcome<Permit<N>>> {
  const read = await findSubmissionById(id)
  if (!read) return refuse({ reason: 'missing' })
  const admitting = names.filter((name) => mismatch(lifecycle[name], read) === null)
  if (admitting.length > 1) {
    throw new Error(
      `${admitting.join(', ')} all admit ${read.status}/${refundState(read.stripeRefundId)}`
    )
  }
  const [name] = admitting
  if (name !== undefined) return { ok: true, value: { transition: name, row: read } as Permit<N> }
  const statusFits = names.some((candidate) => lifecycle[candidate].from.includes(read.status))
  return refuse(
    statusFits
      ? { reason: 'refund', refund: refundState(read.stripeRefundId) }
      : { reason: 'status', status: read.status }
  )
}

export async function transition<K extends Transition>(
  step: Step<K>,
  input: Inputs[K] & SharedInput<K>
): Promise<Outcome<Submission>> {
  const rule = lifecycle[step.transition]
  const problem = mismatch(rule, step.row)
  if (problem) return refuse(problem)
  const updated = await guardedUpdate(step.row, rule.write(input, step.row), input.at)
  return updated ? { ok: true, value: updated } : refuse({ reason: 'stale' })
}
