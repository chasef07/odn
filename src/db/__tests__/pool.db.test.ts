import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { getPool } from '../pool'
const WITH_MILLIS = new Date('2026-03-05T23:30:15.123Z')
const UTC_MIDNIGHT = new Date('2026-03-05T00:00:00.000Z')

async function insertSubmission(): Promise<string> {
  const id = randomUUID()
  await getPool().query(
    `INSERT INTO submissions (id, stripe_payment_intent_id, state, recipient, patient_first_name, patient_last_name,
       patient_date_of_birth, email, phone, note_purpose, first_day_off, last_day_off, absence_reason, symptoms, updated_at)
     VALUES ($1, $1, 'CA', 'work', 'A', 'B', $2, 'a@b.co', '5551234567', 'work', $2, $2, 'illness', $3::jsonb, $4)`,
    [id, UTC_MIDNIGHT, JSON.stringify(['Fever', 1]), WITH_MILLIS]
  )
  return id
}

describe('the pool returns UTC dates, number counts and parsed JSON', () => {
  it('runs these tests in a non-UTC zone so UTC mistakes show', () => {
    expect(WITH_MILLIS.getTimezoneOffset()).not.toBe(0)
  })

  it('round-trips a timestamp(3) to the millisecond and a date as UTC midnight', async () => {
    const id = await insertSubmission()

    const { rows } = await getPool().query(
      'SELECT updated_at, patient_date_of_birth, symptoms FROM submissions WHERE id = $1',
      [id]
    )

    expect(rows[0].updated_at).toEqual(WITH_MILLIS)
    expect(rows[0].patient_date_of_birth).toEqual(UTC_MIDNIGHT)
    expect(rows[0].symptoms).toEqual(['Fever', 1])
  })

  it('fills a CURRENT_TIMESTAMP default with the UTC wall clock', async () => {
    const before = Date.now()
    const id = await insertSubmission()

    const { rows } = await getPool().query('SELECT created_at FROM submissions WHERE id = $1', [id])

    expect(Math.abs(rows[0].created_at.getTime() - before)).toBeLessThan(5000)
  })

  it('returns count(*) as a number', async () => {
    await insertSubmission()
    await insertSubmission()

    const { rows } = await getPool().query('SELECT count(*) AS n FROM submissions')

    expect(rows[0].n).toBe(2)
  })
})
