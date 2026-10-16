import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../pool'
import { sql } from '../sql'
import { insert } from '../table'
import { temporarySubmissions } from '../tables'
import {
  attachPaymentIntentToTemporarySubmission,
  countExpiredTemporarySubmissions,
  countTemporarySubmissions,
  createTemporarySubmission,
  deleteExpiredTemporarySubmissions,
  deleteTemporarySubmission,
  findRecentTemporarySubmissions,
  findTemporarySubmissionById,
  findTemporarySubmissionByPaymentIntent,
} from '../temporary-submissions'

const formData = {
  email: 'john@example.com',
  reasons: ['flu', 'fever'],
  dates: { start: '2026-08-01', end: null },
  agreed: true,
  age: 34,
}

async function seed(id: string, paymentIntentId: string, createdAt: Date, expiresAt: Date) {
  await db.affected(
    sql`${insert(temporarySubmissions, { id, paymentIntentId, formData, createdAt, expiresAt })}`
  )
}

describe('temporary submissions', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates two pending checkouts in the same millisecond without a unique violation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-01T12:00:00.000Z'))
    const pendingCheckout = () =>
      createTemporarySubmission({
        paymentIntentId: `pending_${Date.now()}`,
        formData,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      })

    const first = await pendingCheckout()
    const second = await pendingCheckout()

    expect(first.paymentIntentId).toMatch(/^pending_/)
    expect(second.paymentIntentId).toMatch(/^pending_/)
    expect(second.paymentIntentId).not.toBe(first.paymentIntentId)
    expect(await countTemporarySubmissions()).toBe(2)
  })

  it('creates a row with a generated id and created_at, the given expiry, and the form data round-tripped', async () => {
    const before = Date.now()
    const expiresAt = new Date('2026-08-06T07:30:00.123Z')

    const created = await createTemporarySubmission({
      paymentIntentId: 'pending_1',
      formData,
      expiresAt,
    })

    expect(created).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      paymentIntentId: 'pending_1',
      formData,
      createdAt: expect.any(Date),
      expiresAt,
    })
    expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(created.createdAt.getTime()).toBeLessThanOrEqual(Date.now())
    expect(await findTemporarySubmissionById(created.id)).toEqual(created)
  })

  it('finds a row by payment intent and returns null when none matches', async () => {
    await seed('temp_1', 'pi_1', new Date('2026-08-01T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))

    expect(await findTemporarySubmissionByPaymentIntent('pi_1')).toEqual({
      id: 'temp_1',
      paymentIntentId: 'pi_1',
      formData,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      expiresAt: new Date('2026-08-06T00:00:00Z'),
    })
    expect(await findTemporarySubmissionByPaymentIntent('pi_missing')).toBeNull()
  })

  it('finds a row by id and returns null when none matches', async () => {
    await seed('temp_1', 'pi_1', new Date('2026-08-01T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))

    expect(await findTemporarySubmissionById('temp_1')).toMatchObject({
      id: 'temp_1',
      paymentIntentId: 'pi_1',
    })
    expect(await findTemporarySubmissionById('temp_missing')).toBeNull()
  })

  it('attaches the payment intent id to that row only and returns the updated row', async () => {
    await seed(
      'temp_1',
      'pending_1',
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-06T00:00:00Z')
    )
    await seed(
      'temp_2',
      'pending_2',
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-06T00:00:00Z')
    )

    const updated = await attachPaymentIntentToTemporarySubmission('temp_1', 'pi_1')

    expect(updated).toEqual({
      id: 'temp_1',
      paymentIntentId: 'pi_1',
      formData,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      expiresAt: new Date('2026-08-06T00:00:00Z'),
    })
    expect(await findTemporarySubmissionByPaymentIntent('pi_1')).toEqual(updated)
    expect(await findTemporarySubmissionByPaymentIntent('pending_1')).toBeNull()
    expect(await findTemporarySubmissionById('temp_2')).toMatchObject({
      paymentIntentId: 'pending_2',
    })
  })

  it('throws when attaching a payment intent to a missing row and leaves other rows alone', async () => {
    await seed(
      'temp_2',
      'pending_2',
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-06T00:00:00Z')
    )

    await expect(attachPaymentIntentToTemporarySubmission('temp_missing', 'pi_1')).rejects.toThrow(
      'temp_missing'
    )

    expect(await findTemporarySubmissionById('temp_2')).toMatchObject({
      paymentIntentId: 'pending_2',
    })
  })

  it('deletes a row by id and throws when the row is missing', async () => {
    await seed('temp_1', 'pi_1', new Date('2026-08-01T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))
    await seed('temp_2', 'pi_2', new Date('2026-08-01T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))

    await expect(deleteTemporarySubmission('temp_1')).resolves.toBeUndefined()

    expect(await findTemporarySubmissionById('temp_1')).toBeNull()
    expect(await findTemporarySubmissionById('temp_2')).not.toBeNull()
    await expect(deleteTemporarySubmission('temp_1')).rejects.toThrow('temp_1')
  })

  it('deletes and counts only rows that expired strictly before now', async () => {
    const now = new Date('2026-08-23T12:00:00.000Z')
    const created = new Date('2026-08-01T00:00:00Z')
    await seed('expired_1', 'pi_1', created, new Date('2026-08-20T00:00:00.000Z'))
    await seed('expired_2', 'pi_2', created, new Date('2026-08-23T11:59:59.999Z'))
    await seed('at_now', 'pi_3', created, now)
    await seed('later', 'pi_4', created, new Date('2026-08-24T00:00:00.000Z'))

    expect(await countTemporarySubmissions()).toBe(4)
    expect(await countExpiredTemporarySubmissions(now)).toBe(2)

    expect(await deleteExpiredTemporarySubmissions(now)).toEqual({ count: 2 })

    expect(await countTemporarySubmissions()).toBe(2)
    expect(await countExpiredTemporarySubmissions(now)).toBe(0)
    expect(await findTemporarySubmissionById('at_now')).not.toBeNull()
    expect(await findTemporarySubmissionById('later')).not.toBeNull()
    expect(await deleteExpiredTemporarySubmissions(now)).toEqual({ count: 0 })
  })

  it('counts zero when the table is empty', async () => {
    expect(await countTemporarySubmissions()).toBe(0)
    expect(await countExpiredTemporarySubmissions(new Date())).toBe(0)
  })

  it('lists the five newest rows by created_at without form data', async () => {
    const expiresAt = new Date('2026-09-01T00:00:00Z')
    for (const day of [3, 1, 6, 2, 5, 4]) {
      await seed(`temp_${day}`, `pi_${day}`, new Date(`2026-08-0${day}T00:00:00Z`), expiresAt)
    }

    expect(await findRecentTemporarySubmissions()).toEqual(
      [6, 5, 4, 3, 2].map((day) => ({
        id: `temp_${day}`,
        paymentIntentId: `pi_${day}`,
        createdAt: new Date(`2026-08-0${day}T00:00:00Z`),
        expiresAt,
      }))
    )
  })
})
