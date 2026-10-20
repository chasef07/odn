import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { db } from '../pool'
import { sql } from '../sql'
import {
  permit,
  refundState,
  RELEASE_TARGETS,
  reservedRefundId,
  transition,
  type Decision,
  type Permit,
  type RefundState,
  type Transition,
} from '../submission-lifecycle'
import { findSubmissionById } from '../submissions'
import { SubmissionStatus, type DenialChoice, type Submission } from '../types'
import { seedAdmins, seedSubmission } from './seed'

const T0 = new Date('2026-03-05T12:00:00.000Z')
const ADMIN = 'admin_1'
const EARLIER_ADMIN = 'admin_0'

function at(minutesAfterT0: number): Date {
  return new Date(T0.getTime() + minutesAfterT0 * 60 * 1000)
}

type State = { status: SubmissionStatus; refund: RefundState }

const statuses = Object.values(SubmissionStatus)
const refunds: RefundState[] = ['none', 'reserved', 'refunded']
const everyState: State[] = statuses.flatMap((status) =>
  refunds.map((refund) => ({ status, refund }))
)

function label({ status, stripeRefundId }: Submission): string {
  return `${status}/${refundState(stripeRefundId)}`
}

function seed(state: State, overrides: Partial<Submission> = {}): Promise<Submission> {
  return seedSubmission(state, {
    refundedAt: state.refund === 'refunded' ? at(-2) : null,
    reviewedByAdminId: EARLIER_ADMIN,
    reviewedAt: at(-10),
    denialReason: 'Other',
    denialNote: 'stale note',
    maybeReason: 'OLD_REASON',
    maybeInternalNote: 'keep',
    maybeApprovedDays: 1,
    maybeEmailSentAt: at(-3),
    approvalEmailSentAt: at(-4),
    denialEmailSentAt: at(-5),
    approvalDiagnosis: 'old diagnosis',
    approvalWithRestrictions: false,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  })
}

function seedAdmin(): Promise<void> {
  return seedAdmins(EARLIER_ADMIN, ADMIN)
}

async function reload(id: string): Promise<Submission> {
  const row = await findSubmissionById(id)
  if (!row) throw new Error(`${id} vanished`)
  return row
}

async function permitted<N extends Decision>(id: string, ...names: [N, ...N[]]) {
  const result = await permit(id, ...names)
  if (!result.ok) throw new Error(`permit refused: ${result.refusal.reason}`)
  return result.value
}

async function rawUpdate(id: string, assignments: ReturnType<typeof sql>): Promise<void> {
  expect(await db.affected(sql`UPDATE submissions SET ${assignments} WHERE id = ${id}`)).toBe(1)
}

const stray = { maybeInternalNote: 'leak', stripeRefundId: 're_leak', status: 'APPROVED' }

const review = (when: Date) => ({ ...stray, adminId: ADMIN, at: when })
const approval = (when: Date) => ({ ...review(when), diagnosis: 'flu', withRestrictions: true })
const denial = (when: Date) => ({ ...review(when), reason: 'Legal' as const, note: null })
const maybeReview = (when: Date) => ({
  ...review(when),
  reason: 'OTHER_REVIEW',
  internalNote: 'look',
  approvedDays: 2,
})

function priorOf(row: Submission): Submission {
  return { ...row, status: SubmissionStatus.MAYBE, stripeRefundId: null }
}

type Case<K extends Transition> = {
  start: State
  input: (row: Submission, when: Date) => Parameters<typeof transition<K>>[1]
  writes: (row: Submission, when: Date) => Partial<Submission>
}

const reviewed = (when: Date) => ({ reviewedByAdminId: ADMIN, reviewedAt: when })
const approvalWrite = (_: Submission, when: Date) => ({
  status: SubmissionStatus.APPROVED,
  ...reviewed(when),
  denialReason: null,
  denialNote: null,
  approvalDiagnosis: 'flu',
  approvalWithRestrictions: true,
})
const reservationWrite = (row: Submission, when: Date) => ({
  status: SubmissionStatus.DENIED,
  ...reviewed(when),
  denialReason: 'Legal' as const,
  denialNote: null,
  stripeRefundId: reservedRefundId(row.id),
})
const maybeWrite = (_: Submission, when: Date) => ({
  status: SubmissionStatus.MAYBE,
  ...reviewed(when),
  maybeReason: 'OTHER_REVIEW',
  maybeInternalNote: 'look',
  maybeApprovedDays: 2,
  maybeEmailSentAt: null,
})
const manualWrite = (_: Submission, when: Date) => ({
  status: SubmissionStatus.MANUAL,
  ...reviewed(when),
})

const cases: { [K in Transition]: Case<K> } = {
  approve: {
    start: { status: 'PENDING_REVIEW', refund: 'none' },
    input: (_, when) => approval(when),
    writes: approvalWrite,
  },
  approveManual: {
    start: { status: 'MANUAL', refund: 'none' },
    input: (_, when) => review(when),
    writes: (_, when) => ({
      status: SubmissionStatus.APPROVED,
      ...reviewed(when),
      denialReason: null,
      denialNote: null,
      approvalEmailSentAt: null,
      approvalDiagnosis: null,
      approvalWithRestrictions: null,
    }),
  },
  reapprove: {
    start: { status: 'APPROVED', refund: 'none' },
    input: (_, when) => approval(when),
    writes: approvalWrite,
  },
  deny: {
    start: { status: 'PENDING_REVIEW', refund: 'none' },
    input: (_, when) => denial(when),
    writes: reservationWrite,
  },
  denyManual: {
    start: { status: 'MANUAL', refund: 'none' },
    input: (_, when) => denial(when),
    writes: (_, when) => ({
      status: SubmissionStatus.DENIED,
      ...reviewed(when),
      denialReason: 'Legal',
      denialNote: null,
      denialEmailSentAt: null,
    }),
  },
  denyRefunded: {
    start: { status: 'MAYBE', refund: 'refunded' },
    input: (_, when) => denial(when),
    writes: (_, when) => ({
      status: SubmissionStatus.DENIED,
      ...reviewed(when),
      denialReason: 'Legal',
      denialNote: null,
    }),
  },
  overrideDeny: {
    start: { status: 'APPROVED', refund: 'none' },
    input: (_, when) => denial(when),
    writes: reservationWrite,
  },
  overrideDenyRefunded: {
    start: { status: 'APPROVED', refund: 'refunded' },
    input: (_, when) => denial(when),
    writes: (_, when) => ({
      status: SubmissionStatus.DENIED,
      ...reviewed(when),
      denialReason: 'Legal',
      denialNote: null,
    }),
  },
  maybe: {
    start: { status: 'PENDING_REVIEW', refund: 'none' },
    input: (_, when) => maybeReview(when),
    writes: maybeWrite,
  },
  overrideMaybe: {
    start: { status: 'APPROVED', refund: 'none' },
    input: (_, when) => maybeReview(when),
    writes: maybeWrite,
  },
  markManual: {
    start: { status: 'MAYBE', refund: 'none' },
    input: (_, when) => review(when),
    writes: manualWrite,
  },
  overrideManual: {
    start: { status: 'APPROVED', refund: 'none' },
    input: (_, when) => review(when),
    writes: manualWrite,
  },
  reopen: {
    start: { status: 'DENIED', refund: 'none' },
    input: (_, when) => ({ ...stray, at: when }),
    writes: () => ({
      status: SubmissionStatus.PENDING_REVIEW,
      reviewedByAdminId: null,
      reviewedAt: null,
    }),
  },
  recordRefund: {
    start: { status: 'DENIED', refund: 'reserved' },
    input: (_, when) => ({ ...stray, at: when, stripeRefundId: `re_${when.getTime()}` }),
    writes: (_, when) => ({ stripeRefundId: `re_${when.getTime()}`, refundedAt: when }),
  },
  releaseRefund: {
    start: { status: 'DENIED', refund: 'reserved' },
    input: (row, when) => ({ ...stray, at: when, prior: priorOf(row) }),
    writes: (row) => ({
      status: SubmissionStatus.MAYBE,
      stripeRefundId: null,
      denialReason: row.denialReason,
      denialNote: row.denialNote,
      reviewedByAdminId: row.reviewedByAdminId,
      reviewedAt: row.reviewedAt,
      refundedAt: row.refundedAt,
    }),
  },
}

const admitted: Record<Transition, readonly string[]> = {
  approve: ['PENDING_REVIEW/none', 'MAYBE/none'],
  approveManual: ['MANUAL/none'],
  reapprove: ['APPROVED/none'],
  deny: ['PENDING_REVIEW/none', 'MAYBE/none'],
  denyManual: ['MANUAL/none'],
  denyRefunded: ['PENDING_REVIEW/refunded', 'MAYBE/refunded', 'MANUAL/refunded'],
  overrideDeny: ['PENDING_REVIEW/none', 'MAYBE/none', 'MANUAL/none', 'APPROVED/none'],
  overrideDenyRefunded: [
    'PENDING_REVIEW/refunded',
    'MAYBE/refunded',
    'MANUAL/refunded',
    'APPROVED/refunded',
  ],
  maybe: ['PENDING_REVIEW/none'],
  overrideMaybe: ['PENDING_REVIEW/none', 'MANUAL/none', 'APPROVED/none', 'DENIED/none'],
  markManual: ['MAYBE/none'],
  overrideManual: ['PENDING_REVIEW/none', 'MAYBE/none', 'APPROVED/none', 'DENIED/none'],
  reopen: ['MAYBE/none', 'MANUAL/none', 'APPROVED/none', 'DENIED/none'],
  recordRefund: ['DENIED/reserved'],
  releaseRefund: ['DENIED/reserved'],
}

const transitions = Object.keys(cases) as Transition[]
const settlements = ['recordRefund', 'releaseRefund'] as const

function isDecision(name: Transition): name is Decision {
  return !settlements.some((settlement) => settlement === name)
}

function attempt<K extends Transition>(name: K, row: Submission, when: Date) {
  const step: Permit<K> = { transition: name, row }
  return transition(step, cases[name].input(row, when))
}

function otherStatus(status: SubmissionStatus): SubmissionStatus {
  const other = statuses.find((candidate) => candidate !== status)
  if (!other) throw new Error('no other status')
  return other
}

function otherRefundId(row: Submission): string | null {
  return { none: 're_late', reserved: null, refunded: 're_other' }[refundState(row.stripeRefundId)]
}

describe('every transition', () => {
  it.each(transitions)(
    '%s admits exactly its states, refuses the rest unchanged, and its early check agrees with its write',
    async (name) => {
      await seedAdmin()
      const rows: Submission[] = []
      for (const state of everyState) rows.push(await seed(state))
      const passed: string[] = []

      for (const row of rows) {
        const early = isDecision(name) ? (await permit(row.id, name)).ok : null
        const written = await attempt(name, row, at(1))
        if (early !== null) expect(early).toBe(written.ok)
        if (written.ok) {
          passed.push(label(row))
        } else {
          expect(['status', 'refund']).toContain(written.refusal.reason)
          expect(await reload(row.id)).toEqual(row)
        }
      }

      expect(passed.sort()).toEqual([...admitted[name]].sort())
    }
  )

  it.each(transitions)(
    '%s writes exactly its columns, stamps updated_at with the input time, returns the row, and leaves a neighbour alone',
    async (name) => {
      await seedAdmin()
      const row = await seed(cases[name].start)
      const neighbour = await seed(cases[name].start)

      const result = await attempt(name, row, at(1))

      const expected = { ...row, ...cases[name].writes(row, at(1)), updatedAt: at(1) }
      expect(result).toEqual({ ok: true, value: expected })
      expect(await reload(row.id)).toEqual(expected)
      expect(await reload(neighbour.id)).toEqual(neighbour)
    }
  )

  it.each(transitions)(
    '%s refuses a read whose status changed underneath it without a new version, and writes nothing',
    async (name) => {
      await seedAdmin()
      const row = await seed(cases[name].start)
      await rawUpdate(row.id, sql`status = ${otherStatus(row.status)}`)
      const live = await reload(row.id)
      expect(live.updatedAt).toEqual(row.updatedAt)

      expect(await attempt(name, row, at(1))).toEqual({ ok: false, refusal: { reason: 'stale' } })
      expect(await reload(row.id)).toEqual(live)
    }
  )

  it.each(transitions)(
    '%s refuses a read whose refund changed underneath it while its status stayed, and writes nothing',
    async (name) => {
      await seedAdmin()
      const row = await seed(cases[name].start)
      await rawUpdate(row.id, sql`stripe_refund_id = ${otherRefundId(row)}`)
      const live = await reload(row.id)
      expect(live.status).toBe(row.status)

      expect(await attempt(name, row, at(1))).toEqual({ ok: false, refusal: { reason: 'stale' } })
      expect(await reload(row.id)).toEqual(live)
    }
  )

  it.each(transitions)(
    '%s lets exactly one of 20 concurrent writes from one read win',
    async (name) => {
      await seedAdmin()
      const row = await seed(cases[name].start)

      const results = await Promise.all(
        Array.from({ length: 20 }, (_, racer) => attempt(name, row, at(1 + racer)))
      )

      const winners = results.flatMap((result) => (result.ok ? [result.value] : []))
      const losers = results.flatMap((result) => (result.ok ? [] : [result.refusal.reason]))
      expect(winners).toHaveLength(1)
      expect(losers).toEqual(Array(19).fill('stale'))
      expect(await reload(row.id)).toEqual(winners[0])
    }
  )
})

describe('the version pin', () => {
  it('re-approve refuses a row edited after the read, or read with a version the row never had', async () => {
    await seedAdmin()
    const edited = await seed(cases.reapprove.start)
    await rawUpdate(edited.id, sql`patient_first_name = 'Jon', updated_at = ${at(1)}`)
    expect(await attempt('reapprove', edited, at(2))).toEqual({
      ok: false,
      refusal: { reason: 'stale' },
    })

    const row = await seed(cases.reapprove.start)
    const future: Permit<'reapprove'> = {
      transition: 'reapprove',
      row: { ...row, updatedAt: at(5) },
    }
    expect(await transition(future, approval(at(6)))).toEqual({
      ok: false,
      refusal: { reason: 'stale' },
    })
    expect(await reload(row.id)).toEqual(row)
  })

  it('approve still commits when only the details changed between the read and the write', async () => {
    await seedAdmin()
    const row = await seed(cases.approve.start)
    await rawUpdate(row.id, sql`patient_first_name = 'Jon', updated_at = ${at(1)}`)

    expect(await attempt('approve', row, at(2))).toMatchObject({
      ok: true,
      value: { status: 'APPROVED', patientFirstName: 'Jon', updatedAt: at(2) },
    })
  })

  it('records the refund although an admin edited the details while Stripe answered', async () => {
    await seedAdmin()
    const row = await seed(cases.deny.start)
    const reserved = await transition(await permitted(row.id, 'deny'), denial(at(1)))
    if (!reserved.ok) throw new Error(reserved.refusal.reason)
    await rawUpdate(row.id, sql`patient_first_name = 'Jon', updated_at = ${at(2)}`)

    expect(
      await transition(
        { transition: 'recordRefund', row: reserved.value },
        { at: at(3), stripeRefundId: 're_1' }
      )
    ).toMatchObject({
      ok: true,
      value: { stripeRefundId: 're_1', refundedAt: at(3), patientFirstName: 'Jon' },
    })
  })
})

describe('the approval columns', () => {
  it.each(['approve', 'reapprove'] as const)(
    '%s writes the restriction choice the doctor made',
    async (name) => {
      await seedAdmin()
      const row = await seed(cases[name].start, { approvalWithRestrictions: true })

      const written = await transition(
        { transition: name, row },
        { ...approval(at(1)), withRestrictions: false }
      )
      expect(written).toMatchObject({ ok: true, value: { approvalWithRestrictions: false } })
      expect(await reload(row.id)).toMatchObject({ approvalWithRestrictions: false })
    }
  )
})

describe('permit', () => {
  it('reads the row once and picks the one candidate that admits it', async () => {
    await seedAdmin()
    const manual = await seed({ status: 'MANUAL', refund: 'none' })
    const pending = await seed({ status: 'PENDING_REVIEW', refund: 'none' })

    expect(await permit(manual.id, 'approveManual', 'approve')).toEqual({
      ok: true,
      value: { transition: 'approveManual', row: manual },
    })
    expect(await permit(pending.id, 'approveManual', 'approve')).toEqual({
      ok: true,
      value: { transition: 'approve', row: pending },
    })
  })

  it('throws when two candidates admit the same row instead of picking one', async () => {
    await seedAdmin()
    const pending = await seed({ status: 'PENDING_REVIEW', refund: 'none' })

    await expect(permit(pending.id, 'deny', 'overrideDeny')).rejects.toThrow(
      'deny, overrideDeny all admit PENDING_REVIEW/none'
    )
    expect(await reload(pending.id)).toEqual(pending)
  })

  it('refuses a refunded row by its refund, a wrong status by its status, and a missing row', async () => {
    await seedAdmin()
    const refunded = await seed({ status: 'MAYBE', refund: 'refunded' })
    const reserved = await seed({ status: 'DENIED', refund: 'reserved' })
    const denied = await seed({ status: 'DENIED', refund: 'none' })

    expect(await permit(refunded.id, 'approveManual', 'approve')).toEqual({
      ok: false,
      refusal: { reason: 'refund', refund: 'refunded' },
    })
    expect(await permit(denied.id, 'approveManual', 'approve')).toEqual({
      ok: false,
      refusal: { reason: 'status', status: 'DENIED' },
    })
    expect(await permit(reserved.id, 'overrideDenyRefunded', 'overrideDeny')).toEqual({
      ok: false,
      refusal: { reason: 'status', status: 'DENIED' },
    })
    expect(await permit(randomUUID(), 'approve')).toEqual({
      ok: false,
      refusal: { reason: 'missing' },
    })
  })

  it('lets the queue deny a row the old bug left refunded in review, and nothing else', async () => {
    await seedAdmin()
    const legacy = await seed({ status: 'MAYBE', refund: 'refunded' })

    expect(await permit(legacy.id, 'denyManual', 'denyRefunded', 'deny')).toEqual({
      ok: true,
      value: { transition: 'denyRefunded', row: legacy },
    })
    for (const name of transitions.filter(isDecision).filter((name) => name !== 'denyRefunded')) {
      if (name !== 'overrideDenyRefunded')
        expect(await permit(legacy.id, name)).toMatchObject({ ok: false })
    }
  })

  it('refuses every decision on a refunded denied row', async () => {
    await seedAdmin()
    const refunded = await seed({ status: 'DENIED', refund: 'refunded' })
    for (const name of transitions.filter(isDecision)) {
      expect(await permit(refunded.id, name)).toMatchObject({ ok: false })
    }
    expect(await reload(refunded.id)).toEqual(refunded)
  })

  it('refuses every decision on a reserved row', async () => {
    await seedAdmin()
    const reserved = await seed({ status: 'DENIED', refund: 'reserved' })
    for (const name of transitions.filter(isDecision)) {
      expect(await permit(reserved.id, name)).toMatchObject({ ok: false })
    }
  })
})

describe('refund settlement', () => {
  it('releases a reservation back to the exact prior row, including a MAYBE row and its reason', async () => {
    await seedAdmin()
    const prior = await seed(
      { status: 'MAYBE', refund: 'none' },
      { maybeReason: 'OTHER_REVIEW', denialReason: null, denialNote: null }
    )
    const reserved = await transition(await permitted(prior.id, 'deny'), denial(at(1)))
    if (!reserved.ok) throw new Error(reserved.refusal.reason)
    expect(reserved.value).toEqual({
      ...prior,
      status: 'DENIED',
      denialReason: 'Legal',
      denialNote: null,
      reviewedByAdminId: ADMIN,
      reviewedAt: at(1),
      stripeRefundId: reservedRefundId(prior.id),
      updatedAt: at(1),
    })

    const released = await transition(
      { transition: 'releaseRefund', row: reserved.value },
      { at: at(2), prior }
    )
    expect(released).toEqual({ ok: true, value: { ...prior, updatedAt: at(2) } })
    expect(await reload(prior.id)).toEqual({ ...prior, updatedAt: at(2) })
  })

  it('records the refund once, then refuses a second record and a late release', async () => {
    await seedAdmin()
    const prior = await seed({ status: 'PENDING_REVIEW', refund: 'none' })
    const reserved = await transition(await permitted(prior.id, 'deny'), denial(at(1)))
    if (!reserved.ok) throw new Error(reserved.refusal.reason)

    const recorded = await transition(
      { transition: 'recordRefund', row: reserved.value },
      { at: at(2), stripeRefundId: 're_1' }
    )
    expect(recorded).toEqual({
      ok: true,
      value: { ...reserved.value, stripeRefundId: 're_1', refundedAt: at(2), updatedAt: at(2) },
    })

    expect(
      await transition(
        { transition: 'recordRefund', row: reserved.value },
        { at: at(3), stripeRefundId: 're_2' }
      )
    ).toEqual({ ok: false, refusal: { reason: 'stale' } })
    expect(
      await transition({ transition: 'releaseRefund', row: reserved.value }, { at: at(3), prior })
    ).toEqual({ ok: false, refusal: { reason: 'stale' } })
    expect(await reload(prior.id)).toEqual(recorded.ok ? recorded.value : null)
  })

  it('throws instead of restoring a foreign or already refunded prior row, and instead of recording a sentinel', async () => {
    await seedAdmin()
    const reserved = await seed({ status: 'DENIED', refund: 'reserved' })
    const other = await seed({ status: 'MAYBE', refund: 'none' })
    const step: Permit<'releaseRefund'> = { transition: 'releaseRefund', row: reserved }

    await expect(transition(step, { at: at(1), prior: other })).rejects.toThrow(
      'needs the row read before its reservation'
    )
    await expect(
      transition(step, { at: at(1), prior: { ...reserved, stripeRefundId: 're_old' } })
    ).rejects.toThrow('needs the row read before its reservation')
    await expect(
      transition(step, { at: at(1), prior: { ...reserved, stripeRefundId: null } })
    ).rejects.toThrow(`release of ${reserved.id} cannot restore DENIED, which no deny starts from`)
    expect(RELEASE_TARGETS).toEqual(['PENDING_REVIEW', 'MAYBE', 'MANUAL', 'APPROVED'])
    await expect(
      transition(
        { transition: 'recordRefund', row: reserved },
        { at: at(1), stripeRefundId: reservedRefundId(reserved.id) }
      )
    ).rejects.toThrow('is not a Stripe refund id')
    expect(await reload(reserved.id)).toEqual(reserved)
  })
})

describe('the denial reason', () => {
  const denials = [
    'deny',
    'denyManual',
    'denyRefunded',
    'overrideDeny',
    'overrideDenyRefunded',
  ] as const

  it.each(denials)('%s writes an Other denial with its note over a legacy reason', async (name) => {
    await seedAdmin()
    const row = await seed(cases[name].start, { denialReason: 'Refund', denialNote: null })

    const written = await transition(
      { transition: name, row },
      { adminId: ADMIN, at: at(1), reason: 'Other', note: 'no answer' }
    )

    expect(written).toMatchObject({
      ok: true,
      value: { denialReason: 'Other', denialNote: 'no answer' },
    })
    expect(await reload(row.id)).toMatchObject({ denialReason: 'Other', denialNote: 'no answer' })
  })

  it('releases a reservation back to a legacy reason with no note', async () => {
    await seedAdmin()
    const prior = await seed(
      { status: 'PENDING_REVIEW', refund: 'none' },
      { denialReason: 'Refund', denialNote: null }
    )
    const reserved = await transition(await permitted(prior.id, 'deny'), {
      adminId: ADMIN,
      at: at(1),
      reason: 'Other',
      note: 'no answer',
    })
    if (!reserved.ok) throw new Error(reserved.refusal.reason)

    await transition({ transition: 'releaseRefund', row: reserved.value }, { at: at(2), prior })

    expect(await reload(prior.id)).toEqual({ ...prior, updatedAt: at(2) })
  })

  it.each([
    ['a reason outside the stored set', { reason: 'Legal matter', note: null }],
    ['a note on a reason other than Other', { reason: 'Legal', note: 'court date' }],
  ])('refuses %s and writes nothing', async (_, choice) => {
    await seedAdmin()
    const row = await seed({ status: 'PENDING_REVIEW', refund: 'none' })
    const step = await permitted(row.id, 'deny')

    await expect(
      transition(step, { adminId: ADMIN, at: at(1), ...(choice as DenialChoice) })
    ).rejects.toThrow(/violates check constraint "submissions_denial_(reason|note)_check"/)
    expect(await reload(row.id)).toEqual(row)
  })
})
