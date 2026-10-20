import { db } from './pool'
import { and, sql, type Sql } from './sql'
import { selectAll, set, type Patch } from './table'
import { submissions } from './tables'
import { findSubmissionById } from './submissions'
import { SubmissionStatus, type DenialChoice, type Submission } from './types'

export type RefundState = 'none' | 'reserved' | 'refunded'

const RESERVED_PREFIX = 'pending_'

export function refundState(stripeRefundId: string | null): RefundState {
  if (stripeRefundId === null) return 'none'
  return stripeRefundId.startsWith(RESERVED_PREFIX) ? 'reserved' : 'refunded'
}

export function reservedRefundId(submissionId: string): string {
  return `${RESERVED_PREFIX}${submissionId}`
}

export type Review = { adminId: string; at: Date }
export type Approval = Review & { diagnosis: string | null; withRestrictions: boolean }
export type Denial = Review & DenialChoice
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
  | 'denialNote'
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

type Owned = Patch<Pick<Submission, OwnedColumn | 'status'>>
type Decided = Owned & Pick<Submission, 'status'>

type Reservation = Pick<
  Submission,
  'status' | 'denialReason' | 'denialNote' | 'reviewedByAdminId' | 'reviewedAt' | 'stripeRefundId'
>

type Entry<I extends Stamped, W extends Owned = Decided> = {
  readonly from: readonly SubmissionStatus[]
  readonly refund: RefundState
  readonly write: (input: I, read: Submission) => W
}

function approved(approval: Approval): Decided {
  return {
    status: SubmissionStatus.APPROVED,
    reviewedByAdminId: approval.adminId,
    reviewedAt: approval.at,
    denialReason: null,
    denialNote: null,
    approvalDiagnosis: approval.diagnosis,
    approvalWithRestrictions: approval.withRestrictions,
  }
}

function approvedManually(review: Review): Decided {
  return {
    status: SubmissionStatus.APPROVED,
    reviewedByAdminId: review.adminId,
    reviewedAt: review.at,
    denialReason: null,
    denialNote: null,
    approvalEmailSentAt: null,
    approvalDiagnosis: null,
    approvalWithRestrictions: null,
  }
}

function reserved(denial: Denial, read: Submission): Reservation {
  return {
    status: SubmissionStatus.DENIED,
    denialReason: denial.reason,
    denialNote: denial.note,
    reviewedByAdminId: denial.adminId,
    reviewedAt: denial.at,
    stripeRefundId: reservedRefundId(read.id),
  }
}

function released({ prior }: RefundRelease, read: Submission): Reservation {
  if (prior.id !== read.id || refundState(prior.stripeRefundId) !== 'none') {
    throw new Error(`release of ${read.id} needs the row read before its reservation`)
  }
  if (!RELEASE_TARGETS.includes(prior.status)) {
    throw new Error(
      `release of ${read.id} cannot restore ${prior.status}, which no deny starts from`
    )
  }
  return {
    status: prior.status,
    denialReason: prior.denialReason,
    denialNote: prior.denialNote,
    reviewedByAdminId: prior.reviewedByAdminId,
    reviewedAt: prior.reviewedAt,
    stripeRefundId: null,
  }
}

function recorded(record: RefundRecord): Owned {
  if (refundState(record.stripeRefundId) !== 'refunded') {
    throw new Error(`${record.stripeRefundId} is not a Stripe refund id`)
  }
  return { stripeRefundId: record.stripeRefundId, refundedAt: record.at }
}

function denied(denial: Denial): Decided {
  return {
    status: SubmissionStatus.DENIED,
    denialReason: denial.reason,
    denialNote: denial.note,
    reviewedByAdminId: denial.adminId,
    reviewedAt: denial.at,
  }
}

function deniedManually(denial: Denial): Decided {
  return { ...denied(denial), denialEmailSentAt: null }
}

function maybe(review: MaybeReview): Decided {
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

function manual(review: Review): Decided {
  return {
    status: SubmissionStatus.MANUAL,
    reviewedByAdminId: review.adminId,
    reviewedAt: review.at,
  }
}

function reopened(_reopening: Reopening): Decided {
  return { status: SubmissionStatus.PENDING_REVIEW, reviewedByAdminId: null, reviewedAt: null }
}

const entries = {
  approve: {
    from: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
    refund: 'none',
    write: approved,
  },
  approveManual: {
    from: [SubmissionStatus.MANUAL],
    refund: 'none',
    write: approvedManually,
  },
  reapprove: {
    from: [SubmissionStatus.APPROVED],
    refund: 'none',
    write: approved,
  },
  deny: {
    from: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
    refund: 'none',
    write: reserved,
  },
  denyManual: {
    from: [SubmissionStatus.MANUAL],
    refund: 'none',
    write: deniedManually,
  },
  denyRefunded: {
    from: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE, SubmissionStatus.MANUAL],
    refund: 'refunded',
    write: denied,
  },
  overrideDeny: {
    from: [
      SubmissionStatus.PENDING_REVIEW,
      SubmissionStatus.MAYBE,
      SubmissionStatus.MANUAL,
      SubmissionStatus.APPROVED,
    ],
    refund: 'none',
    write: reserved,
  },
  overrideDenyRefunded: {
    from: [
      SubmissionStatus.PENDING_REVIEW,
      SubmissionStatus.MAYBE,
      SubmissionStatus.MANUAL,
      SubmissionStatus.APPROVED,
    ],
    refund: 'refunded',
    write: denied,
  },
  maybe: {
    from: [SubmissionStatus.PENDING_REVIEW],
    refund: 'none',
    write: maybe,
  },
  overrideMaybe: {
    from: [
      SubmissionStatus.PENDING_REVIEW,
      SubmissionStatus.MANUAL,
      SubmissionStatus.APPROVED,
      SubmissionStatus.DENIED,
    ],
    refund: 'none',
    write: maybe,
  },
  markManual: {
    from: [SubmissionStatus.MAYBE],
    refund: 'none',
    write: manual,
  },
  overrideManual: {
    from: [
      SubmissionStatus.PENDING_REVIEW,
      SubmissionStatus.MAYBE,
      SubmissionStatus.APPROVED,
      SubmissionStatus.DENIED,
    ],
    refund: 'none',
    write: manual,
  },
  reopen: {
    from: [
      SubmissionStatus.MAYBE,
      SubmissionStatus.MANUAL,
      SubmissionStatus.APPROVED,
      SubmissionStatus.DENIED,
    ],
    refund: 'none',
    write: reopened,
  },
  recordRefund: {
    from: [SubmissionStatus.DENIED],
    refund: 'reserved',
    write: recorded,
  },
  releaseRefund: {
    from: [SubmissionStatus.DENIED],
    refund: 'reserved',
    write: released,
  },
} as const

export const RELEASE_TARGETS: readonly SubmissionStatus[] = [
  ...new Set<SubmissionStatus>([...entries.deny.from, ...entries.overrideDeny.from]),
]

export type Transition = keyof typeof entries
export type Settlement = 'recordRefund' | 'releaseRefund'
export type Decision = Exclude<Transition, Settlement>

type Inputs = { [K in Transition]: Parameters<(typeof entries)[K]['write']>[0] }

const lifecycle: { [K in Transition]: Entry<Inputs[K], Owned> } = entries

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

type Intersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I
) => void
  ? I
  : never

type SameInputAcross<K extends Transition> = [Inputs[K]] extends [Intersection<Inputs[K]>]
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

function leavesGuardsUnchanged(read: Guarded, next: Owned): boolean {
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

async function guardedUpdate(read: Submission, next: Owned, at: Date): Promise<Submission | null> {
  return db.one(
    sql`UPDATE submissions SET ${set(submissions, { ...next, updatedAt: at })} WHERE ${and(
      sql`id = ${read.id}`,
      ...Object.values(pinned(read)),
      leavesGuardsUnchanged(read, next) && sql`updated_at = ${read.updatedAt}`
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
  input: Inputs[K] & SameInputAcross<K>
): Promise<Outcome<Submission>> {
  const rule = lifecycle[step.transition]
  const problem = mismatch(rule, step.row)
  if (problem) return refuse(problem)
  const updated = await guardedUpdate(step.row, rule.write(input, step.row), input.at)
  return updated ? { ok: true, value: updated } : refuse({ reason: 'stale' })
}
