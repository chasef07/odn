import { randomUUID } from 'node:crypto'
import { db } from '../pool'
import { sql } from '../sql'
import { insert, selectAll } from '../table'
import { submissions, users } from '../tables'
import { reservedRefundId, type RefundState } from '../submission-lifecycle'
import type { Submission, SubmissionStatus } from '../types'

export type SeedState = { status: SubmissionStatus; refund: RefundState }

export async function seedSubmission(
  state: SeedState,
  overrides: Partial<Submission> = {}
): Promise<Submission> {
  const id = overrides.id ?? randomUUID()
  const stripeRefundId = { none: null, reserved: reservedRefundId(id), refunded: `re_${id}` }[
    state.refund
  ]
  const row = await db.one(
    sql`${insert(submissions, {
      id,
      status: state.status,
      stripeRefundId,
      refundedAt: state.refund === 'refunded' ? new Date('2026-03-05T11:58:00.000Z') : null,
      stripePaymentIntentId: `pi_${id}`,
      state: 'CA',
      recipient: 'myself',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      patientDateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
      email: 'john@example.com',
      phone: '(555) 123-4567',
      smsOptIn: false,
      notePurpose: 'work',
      firstDayOff: new Date('2026-03-02T00:00:00.000Z'),
      lastDayOff: new Date('2026-03-04T00:00:00.000Z'),
      absenceReason: 'illness',
      ...overrides,
    })} RETURNING ${selectAll(submissions)}`
  )
  if (!row) throw new Error('seed failed')
  return row
}

export async function seedAdmins(...ids: string[]): Promise<void> {
  for (const id of ids) {
    await db.affected(
      sql`${insert(users, { id, email: `${id}@example.com`, emailVerified: true, name: 'Doc' })}`
    )
  }
}
