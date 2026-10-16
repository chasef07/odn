import { db } from './pool'
import { count, sql } from './sql'
import { insert, select, selectAll, set } from './table'
import { temporarySubmissions } from './tables'
import type { JsonValue, TemporarySubmission } from './types'

export async function createTemporarySubmission({
  paymentIntentId,
  formData,
  expiresAt,
}: {
  paymentIntentId: string
  formData: JsonValue
  expiresAt: Date
}): Promise<TemporarySubmission> {
  const [row] = await db.rows(
    sql`${insert(temporarySubmissions, { paymentIntentId, formData, expiresAt })} RETURNING ${selectAll(temporarySubmissions)}`
  )
  return row
}

export async function findTemporarySubmissionByPaymentIntent(
  paymentIntentId: string
): Promise<TemporarySubmission | null> {
  return db.one(
    sql`SELECT ${selectAll(temporarySubmissions)} FROM temporary_submissions WHERE payment_intent_id = ${paymentIntentId}`
  )
}

export async function findTemporarySubmissionById(id: string): Promise<TemporarySubmission | null> {
  return db.one(
    sql`SELECT ${selectAll(temporarySubmissions)} FROM temporary_submissions WHERE id = ${id}`
  )
}

export async function attachPaymentIntentToTemporarySubmission(
  id: string,
  paymentIntentId: string
): Promise<TemporarySubmission> {
  const row = await db.one(
    sql`UPDATE temporary_submissions SET ${set(temporarySubmissions, { paymentIntentId })} WHERE id = ${id} RETURNING ${selectAll(temporarySubmissions)}`
  )
  if (!row) throw new Error(`Temporary submission ${id} not found`)
  return row
}

export async function deleteTemporarySubmission(id: string): Promise<void> {
  const deleted = await db.affected(sql`DELETE FROM temporary_submissions WHERE id = ${id}`)
  if (deleted === 0) throw new Error(`Temporary submission ${id} not found`)
}

export async function deleteExpiredTemporarySubmissions(now: Date): Promise<{ count: number }> {
  return {
    count: await db.affected(sql`DELETE FROM temporary_submissions WHERE expires_at < ${now}`),
  }
}

export async function countTemporarySubmissions(): Promise<number> {
  const [row] = await db.rows(sql`SELECT ${count('total')} FROM temporary_submissions`)
  return row.total
}

export async function countExpiredTemporarySubmissions(now: Date): Promise<number> {
  const [row] = await db.rows(
    sql`SELECT ${count('total')} FROM temporary_submissions WHERE expires_at < ${now}`
  )
  return row.total
}

export async function findRecentTemporarySubmissions(): Promise<
  Pick<TemporarySubmission, 'id' | 'paymentIntentId' | 'createdAt' | 'expiresAt'>[]
> {
  return db.rows(
    sql`SELECT ${select(temporarySubmissions, ['id', 'paymentIntentId', 'createdAt', 'expiresAt'])} FROM temporary_submissions ORDER BY created_at DESC LIMIT 5`
  )
}
