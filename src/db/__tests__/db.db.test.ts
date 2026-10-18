import type { Socket } from 'node:net'
import type pg from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { db, getPool, type Db } from '../pool'
import { count, sql } from '../sql'
import { array, json, likeContains, and } from '../sql'
import { insert, select, selectAll, set } from '../table'
import { submissions, telnyxWebhookEvents } from '../tables'

function dropConnection(client: pg.PoolClient): void {
  const { connection } = client as unknown as { connection: { stream: Socket } }
  connection.stream.destroy()
}

function nextAcquiredClient(): Promise<pg.PoolClient> {
  return new Promise((resolve) => getPool().once('acquire', resolve))
}

const event = {
  id: 'evt_1',
  eventType: 'message.received',
  occurredAt: new Date('2026-03-05T23:30:15.123Z'),
  status: 'PROCESSING',
  lastError: null,
  processedAt: new Date('2026-03-05T23:30:16.000Z'),
}

describe('db', () => {
  it('inserts, reads one typed row, counts, and reports affected rows', async () => {
    expect(await db.affected(sql`${insert(telnyxWebhookEvents, event)}`)).toBe(1)

    const row = await db.one(
      sql`SELECT ${selectAll(telnyxWebhookEvents)} FROM telnyx_webhook_events WHERE id = ${event.id}`
    )
    expect(row).toEqual(event)

    const summary = await db.one(
      sql`SELECT ${select(telnyxWebhookEvents, ['status'])}, ${count('total')} FROM telnyx_webhook_events GROUP BY status`
    )
    expect(summary).toEqual({ status: 'PROCESSING', total: 1 })

    expect(
      await db.one(
        sql`SELECT ${selectAll(telnyxWebhookEvents)} FROM telnyx_webhook_events WHERE id = ${'missing'}`
      )
    ).toBeNull()
    expect(
      await db.rows(sql`SELECT ${select(telnyxWebhookEvents, ['id'])} FROM telnyx_webhook_events`)
    ).toEqual([{ id: 'evt_1' }])
  })

  it('reports zero affected rows for a duplicate insert with ON CONFLICT DO NOTHING', async () => {
    await db.affected(sql`${insert(telnyxWebhookEvents, event)}`)

    expect(
      await db.affected(sql`${insert(telnyxWebhookEvents, event)} ON CONFLICT DO NOTHING`)
    ).toBe(0)
  })

  it('returns the updated row from a guarded UPDATE ... RETURNING', async () => {
    await db.affected(sql`${insert(telnyxWebhookEvents, event)}`)

    const updated = await db.one(
      sql`UPDATE telnyx_webhook_events SET ${set(telnyxWebhookEvents, { status: 'PROCESSED' })} WHERE id = ${event.id} AND status = ${'PROCESSING'} RETURNING ${select(telnyxWebhookEvents, ['id', 'status'])}`
    )
    const refused = await db.one(
      sql`UPDATE telnyx_webhook_events SET ${set(telnyxWebhookEvents, { status: 'FAILED' })} WHERE id = ${event.id} AND status = ${'PROCESSING'} RETURNING ${select(telnyxWebhookEvents, ['id'])}`
    )

    expect(updated).toEqual({ id: 'evt_1', status: 'PROCESSED' })
    expect(refused).toBeNull()
  })

  it('commits a transaction on return and rolls it back on throw', async () => {
    const result = await db.transaction(async (tx) => {
      await tx.affected(sql`${insert(telnyxWebhookEvents, event)}`)
      return 'done' as const
    })
    expect(result).toBe('done')
    expect(await db.one(sql`SELECT ${count('n')} FROM telnyx_webhook_events`)).toEqual({ n: 1 })

    await expect(
      db.transaction(async (tx) => {
        await tx.affected(sql`${insert(telnyxWebhookEvents, { ...event, id: 'evt_2' })}`)
        throw new Error('abort')
      })
    ).rejects.toThrow('abort')
    expect(await db.one(sql`SELECT ${count('n')} FROM telnyx_webhook_events`)).toEqual({ n: 1 })
  })

  it(
    'runs a db.* call made inside the transaction callback on the transaction connection',
    { timeout: 2000 },
    async () => {
      await db.transaction(async (tx) => {
        await tx.affected(sql`${insert(telnyxWebhookEvents, event)}`)
        expect(await db.one(sql`SELECT ${count('n')} FROM telnyx_webhook_events`)).toEqual({
          n: 1,
        })
      })
    }
  )

  it(
    'nests a transaction as a savepoint so an inner rollback keeps the outer work',
    { timeout: 2000 },
    async () => {
      await db.transaction(async (tx) => {
        await tx.affected(sql`${insert(telnyxWebhookEvents, event)}`)
        await expect(
          db.transaction(async (inner) => {
            await inner.affected(sql`${insert(telnyxWebhookEvents, { ...event, id: 'evt_2' })}`)
            throw new Error('inner abort')
          })
        ).rejects.toThrow('inner abort')
        expect(await tx.one(sql`SELECT ${count('n')} FROM telnyx_webhook_events`)).toEqual({ n: 1 })
      })
      expect(await db.one(sql`SELECT ${count('n')} FROM telnyx_webhook_events`)).toEqual({ n: 1 })
    }
  )

  it(
    'nests three levels deep so the innermost rollback keeps the middle and outer work',
    { timeout: 2000 },
    async () => {
      const total = () => db.one(sql`SELECT ${count('n')} FROM telnyx_webhook_events`)
      await db.transaction(async (tx) => {
        await tx.affected(sql`${insert(telnyxWebhookEvents, event)}`)
        await db.transaction(async (middle) => {
          await middle.affected(sql`${insert(telnyxWebhookEvents, { ...event, id: 'evt_2' })}`)
          await expect(
            db.transaction(async (inner) => {
              await inner.affected(sql`${insert(telnyxWebhookEvents, { ...event, id: 'evt_3' })}`)
              throw new Error('deepest abort')
            })
          ).rejects.toThrow('deepest abort')
          expect(await total()).toEqual({ n: 2 })
        })
        expect(await total()).toEqual({ n: 2 })
      })
      expect(await total()).toEqual({ n: 2 })
    }
  )

  it(
    'rejects a nested transaction that starts while a sibling nested transaction is open',
    { timeout: 2000 },
    async () => {
      await db.transaction(async (tx) => {
        await tx.affected(sql`${insert(telnyxWebhookEvents, event)}`)
        const [failed, sibling] = await Promise.allSettled([
          db.transaction(async (inner) => {
            await inner.affected(sql`${insert(telnyxWebhookEvents, { ...event, id: 'evt_2' })}`)
            throw new Error('inner abort')
          }),
          db.transaction((inner) =>
            inner.affected(sql`${insert(telnyxWebhookEvents, { ...event, id: 'evt_3' })}`)
          ),
        ])
        expect(failed).toMatchObject({ status: 'rejected', reason: new Error('inner abort') })
        expect(sibling).toMatchObject({
          status: 'rejected',
          reason: new Error(
            'a nested db.transaction started while a sibling nested transaction was still open; savepoints are a stack, so await the sibling first'
          ),
        })
        expect(await tx.one(sql`SELECT ${count('n')} FROM telnyx_webhook_events`)).toEqual({ n: 1 })
      })
      expect(await db.one(sql`SELECT ${count('n')} FROM telnyx_webhook_events`)).toEqual({ n: 1 })
    }
  )

  it('refuses a tx handle once the transaction has committed or rolled back', async () => {
    const committed = await db.transaction(async (tx) => tx)
    await expect(committed.rows(sql`SELECT 1`)).rejects.toThrow(
      'tx handle used after the transaction finished'
    )

    let rolledBack: Db | undefined
    await db
      .transaction(async (tx) => {
        rolledBack = tx
        throw new Error('abort')
      })
      .catch(() => undefined)
    await expect(rolledBack!.one(sql`SELECT 1`)).rejects.toThrow(
      'tx handle used after the transaction finished'
    )
  })

  it('rejects the work, discards the client and stays alive when the connection drops mid-transaction', async () => {
    const acquired = nextAcquiredClient()
    const uncaught = vi.fn()
    process.on('uncaughtException', uncaught)

    try {
      await expect(
        db.transaction(async (tx) => {
          dropConnection(await acquired)
          await tx.rows(sql`SELECT 1`)
        })
      ).rejects.toThrow(/Connection terminated/)
    } finally {
      process.removeListener('uncaughtException', uncaught)
    }

    expect(uncaught).not.toHaveBeenCalled()
    expect(getPool().totalCount).toBe(0)
    expect(await db.one(sql`SELECT 1 AS one`)).toEqual({ one: 1 })
  })

  it(
    'releases the savepoint when a nested transaction returns, leaving only the outer transaction lock',
    { timeout: 2000 },
    async () => {
      const transactionLocks = (tx: Db) =>
        tx.one(
          sql`SELECT ${count('n')} FROM pg_locks WHERE pid = pg_backend_pid() AND locktype = 'transactionid'`
        )
      await db.transaction(async (tx) => {
        await tx.affected(sql`${insert(telnyxWebhookEvents, event)}`)
        await db.transaction(async (inner) => {
          await inner.affected(sql`${insert(telnyxWebhookEvents, { ...event, id: 'evt_2' })}`)
          expect(await transactionLocks(inner)).toEqual({ n: 2 })
        })
        expect(await transactionLocks(tx)).toEqual({ n: 1 })
      })
    }
  )

  it('logs an idle connection failure by message and code, never the error object', () => {
    const error = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
    })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    getPool().emit('error', error, undefined as unknown as pg.PoolClient)

    expect(logged).toHaveBeenCalledWith('Idle database connection failed', {
      message: 'terminating connection due to administrator command',
      code: '57P01',
    })
    logged.mockRestore()
  })

  it('round-trips JSON, DATE and enum columns through insert, set and filters', async () => {
    const dateOfBirth = new Date('1990-05-15T00:00:00.000Z')
    const base = {
      stripePaymentIntentId: 'pi_1',
      state: 'CA',
      recipient: 'work',
      patientFirstName: 'Ann',
      patientLastName: "O'Neil_50%",
      patientDateOfBirth: dateOfBirth,
      email: 'ann@example.test',
      phone: '5551234567',
      notePurpose: 'work',
      firstDayOff: dateOfBirth,
      lastDayOff: dateOfBirth,
      absenceReason: 'illness',
      symptoms: ['Fever', { severity: 2 }],
      attribution: null,
    }
    const inserted = await db.one(
      sql`${insert(submissions, base)} RETURNING ${select(submissions, ['id', 'patientDateOfBirth', 'symptoms', 'attribution', 'status', 'createdAt'])}`
    )
    expect(inserted?.patientDateOfBirth).toEqual(dateOfBirth)
    expect(inserted?.symptoms).toEqual(['Fever', { severity: 2 }])
    expect(inserted?.attribution).toBeNull()
    expect(inserted?.status).toBe('PENDING_REVIEW')
    expect(Math.abs((inserted?.createdAt.getTime() ?? 0) - Date.now())).toBeLessThan(5000)

    await db.affected(
      sql`UPDATE submissions SET ${set(submissions, { attribution: { last: { channel: 'ads' } }, maybeEmailSentAt: sql`now()` })} WHERE id = ${inserted!.id}`
    )
    const rows = await db.rows(
      sql`SELECT ${select(submissions, ['id', 'attribution', 'maybeEmailSentAt'])} FROM submissions WHERE ${and(
        sql`status = ANY(${array(['PENDING_REVIEW', 'MAYBE'], '"SubmissionStatus"')})`,
        sql`patient_last_name ILIKE ${likeContains('neil_50%')}`,
        sql`attribution @> ${json({ last: { channel: 'ads' } })}`
      )}`
    )
    expect(rows.map((row) => row.id)).toEqual([inserted!.id])
    expect(rows[0].attribution).toEqual({ last: { channel: 'ads' } })
    expect(Math.abs((rows[0].maybeEmailSentAt?.getTime() ?? 0) - Date.now())).toBeLessThan(5000)
    expect(
      await db.rows(
        sql`SELECT ${select(submissions, ['id'])} FROM submissions WHERE patient_last_name LIKE ${likeContains('neil50')}`
      )
    ).toEqual([])
  })

  it('refuses a second statement in the query text instead of running it', async () => {
    try {
      await expect(db.rows(sql`SELECT 1; CREATE TABLE pwned (id int)`)).rejects.toThrow(
        /multiple commands/
      )
      expect(
        await db.one(sql`SELECT ${count('n')} FROM pg_tables WHERE tablename = ${'pwned'}`)
      ).toEqual({ n: 0 })
    } finally {
      await getPool().query('DROP TABLE IF EXISTS pwned')
    }
  })

  it('throws when two selections return the same column name', async () => {
    await expect(
      db.rows(
        sql`SELECT ${select(submissions, ['id'])}, ${select(telnyxWebhookEvents, ['id'], { alias: 't' })} FROM submissions, telnyx_webhook_events t`
      )
    ).rejects.toThrow('returns the column "id" twice')
  })
})
