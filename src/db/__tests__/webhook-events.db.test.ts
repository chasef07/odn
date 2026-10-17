import { describe, expect, it } from 'vitest'
import { db } from '../pool'
import { sql } from '../sql'
import { insert, selectAll } from '../table'
import { resendWebhookEvents, telnyxWebhookEvents } from '../tables'
import type { TelnyxWebhookEvent } from '../types'
import {
  claimResendWebhookEvent,
  findTelnyxEventClaim,
  insertProcessingTelnyxEvent,
  markTelnyxEventFailed,
  markTelnyxEventProcessed,
  reclaimTelnyxEvent,
  recordProcessedTelnyxEvent,
} from '../webhook-events'

const occurredAt = new Date('2026-06-16T12:00:00.123Z')
const telnyxEvent = { id: 'evt_message_received', eventType: 'message.received', occurredAt }
const claimedAt = new Date('2026-06-16T12:20:00.456Z')
const staleBefore = new Date('2026-06-16T12:05:00.000Z')

async function seedTelnyx(row: Partial<TelnyxWebhookEvent>): Promise<void> {
  await db.affected(
    insert(telnyxWebhookEvents, {
      id: telnyxEvent.id,
      eventType: 'message.sent',
      occurredAt: new Date('2026-06-15T08:00:00.000Z'),
      status: 'PROCESSING',
      lastError: null,
      processedAt: new Date('2026-06-16T12:01:00.000Z'),
      ...row,
    })
  )
}

async function telnyxRow(id = telnyxEvent.id) {
  return db.one(
    sql`SELECT ${selectAll(telnyxWebhookEvents)} FROM telnyx_webhook_events WHERE id = ${id}`
  )
}

async function resendRows() {
  return db.rows(sql`SELECT ${selectAll(resendWebhookEvents)} FROM resend_webhook_events`)
}

function expectRecent(date: Date | undefined, since: number): void {
  expect(date).toBeInstanceOf(Date)
  expect(date!.getTime()).toBeGreaterThanOrEqual(since - 1000)
  expect(date!.getTime()).toBeLessThanOrEqual(Date.now() + 1000)
}

describe('findTelnyxEventClaim', () => {
  it('returns the claim columns of that event only', async () => {
    await seedTelnyx({ id: 'evt_other', status: 'PROCESSED' })
    await seedTelnyx({ status: 'FAILED', lastError: 'boom', processedAt: occurredAt })

    expect(await findTelnyxEventClaim(telnyxEvent.id)).toEqual({
      id: telnyxEvent.id,
      status: 'FAILED',
      processedAt: occurredAt,
    })
  })

  it('returns null when the event was never seen', async () => {
    await seedTelnyx({ id: 'evt_other' })

    expect(await findTelnyxEventClaim('evt_missing')).toBeNull()
  })
})

describe('recordProcessedTelnyxEvent', () => {
  it('inserts the event as processed now', async () => {
    const since = Date.now()

    await recordProcessedTelnyxEvent(telnyxEvent)

    const row = await telnyxRow()
    expect(row).toMatchObject({ ...telnyxEvent, status: 'PROCESSED', lastError: null })
    expectRecent(row?.processedAt, since)
  })

  it('leaves an existing event untouched on a duplicate id', async () => {
    await seedTelnyx({ status: 'FAILED', lastError: 'boom' })
    const before = await telnyxRow()

    await expect(recordProcessedTelnyxEvent(telnyxEvent)).resolves.toBeUndefined()

    expect(await telnyxRow()).toEqual(before)
  })
})

describe('insertProcessingTelnyxEvent', () => {
  it('claims a new event as processing at the claim time', async () => {
    await expect(insertProcessingTelnyxEvent(telnyxEvent, claimedAt)).resolves.toBe(true)

    expect(await telnyxRow()).toEqual({
      ...telnyxEvent,
      status: 'PROCESSING',
      lastError: null,
      processedAt: claimedAt,
    })
  })

  it('returns false and keeps the first claim when the id already exists', async () => {
    await insertProcessingTelnyxEvent(telnyxEvent, claimedAt)

    await expect(
      insertProcessingTelnyxEvent(
        { ...telnyxEvent, eventType: 'message.finalized' },
        new Date('2026-06-16T13:00:00.000Z')
      )
    ).resolves.toBe(false)

    expect(await telnyxRow()).toMatchObject({
      eventType: 'message.received',
      processedAt: claimedAt,
    })
  })

  it('rejects instead of returning false when the database refuses the row', async () => {
    await expect(
      insertProcessingTelnyxEvent({ ...telnyxEvent, eventType: 'message\u0000received' }, claimedAt)
    ).rejects.toThrow('invalid byte sequence')

    expect(await telnyxRow()).toBeNull()
  })
})

describe('reclaimTelnyxEvent', () => {
  const reclaimed = {
    ...telnyxEvent,
    status: 'PROCESSING',
    lastError: null,
    processedAt: claimedAt,
  }

  it('reclaims only that failed event and rewrites its claim fields', async () => {
    await seedTelnyx({ status: 'FAILED', lastError: 'boom' })
    await seedTelnyx({ id: 'evt_other', status: 'FAILED', lastError: 'other' })
    const other = await telnyxRow('evt_other')

    await expect(reclaimTelnyxEvent(telnyxEvent, { claimedAt, staleBefore })).resolves.toBe(1)

    expect(await telnyxRow()).toEqual(reclaimed)
    expect(await telnyxRow('evt_other')).toEqual(other)
  })

  it('reclaims a failed event whose failure was stamped after the stale cutoff', async () => {
    await seedTelnyx({
      status: 'FAILED',
      lastError: 'boom',
      processedAt: new Date(staleBefore.getTime() + 60_000),
    })

    await expect(reclaimTelnyxEvent(telnyxEvent, { claimedAt, staleBefore })).resolves.toBe(1)

    expect(await telnyxRow()).toEqual(reclaimed)
  })

  it('reclaims a processing event claimed at exactly the stale cutoff', async () => {
    await seedTelnyx({ status: 'PROCESSING', processedAt: staleBefore })

    await expect(reclaimTelnyxEvent(telnyxEvent, { claimedAt, staleBefore })).resolves.toBe(1)

    expect(await telnyxRow()).toEqual(reclaimed)
  })

  it('refuses a processing event another worker claimed after the cutoff', async () => {
    await seedTelnyx({ status: 'PROCESSING', processedAt: new Date(staleBefore.getTime() + 1) })
    const before = await telnyxRow()

    await expect(reclaimTelnyxEvent(telnyxEvent, { claimedAt, staleBefore })).resolves.toBe(0)

    expect(await telnyxRow()).toEqual(before)
  })

  it('refuses a processed event however old', async () => {
    await seedTelnyx({ status: 'PROCESSED', processedAt: new Date('2026-01-01T00:00:00.000Z') })
    const before = await telnyxRow()

    await expect(reclaimTelnyxEvent(telnyxEvent, { claimedAt, staleBefore })).resolves.toBe(0)

    expect(await telnyxRow()).toEqual(before)
  })

  it('returns 0 for an unknown event and leaves other events untouched', async () => {
    await seedTelnyx({ id: 'evt_other', status: 'FAILED', lastError: 'other' })
    const other = await telnyxRow('evt_other')

    await expect(reclaimTelnyxEvent(telnyxEvent, { claimedAt, staleBefore })).resolves.toBe(0)

    expect(await telnyxRow('evt_other')).toEqual(other)
  })
})

describe('markTelnyxEventProcessed', () => {
  it('marks only that event processed now and clears its error', async () => {
    await seedTelnyx({ status: 'FAILED', lastError: 'boom' })
    await seedTelnyx({ id: 'evt_other', status: 'FAILED', lastError: 'other' })
    const other = await telnyxRow('evt_other')
    const since = Date.now()

    await markTelnyxEventProcessed(telnyxEvent.id)

    const row = await telnyxRow()
    expect(row).toMatchObject({ status: 'PROCESSED', lastError: null })
    expectRecent(row?.processedAt, since)
    expect(await telnyxRow('evt_other')).toEqual(other)
  })
})

describe('markTelnyxEventFailed', () => {
  it('marks only that event failed now with the error message', async () => {
    await seedTelnyx({ status: 'PROCESSING' })
    await seedTelnyx({ id: 'evt_other', status: 'PROCESSING' })
    const other = await telnyxRow('evt_other')
    const since = Date.now()

    await markTelnyxEventFailed(telnyxEvent.id, new Error('support route failed'))

    const row = await telnyxRow()
    expect(row).toMatchObject({ status: 'FAILED', lastError: 'support route failed' })
    expectRecent(row?.processedAt, since)
    expect(await telnyxRow('evt_other')).toEqual(other)
  })

  it('records a generic message when the thrown value is not an Error', async () => {
    await seedTelnyx({ status: 'PROCESSING' })

    await markTelnyxEventFailed(telnyxEvent.id, 'boom')

    expect(await telnyxRow()).toMatchObject({
      status: 'FAILED',
      lastError: 'Unknown support routing error',
    })
  })
})

describe('claimResendWebhookEvent', () => {
  it('claims a new event once and refuses the duplicate', async () => {
    const since = Date.now()
    const event = { id: 'msg_123', emailId: 'email_123', eventType: 'email.bounced' }

    await expect(claimResendWebhookEvent(event)).resolves.toBe(true)
    await expect(
      claimResendWebhookEvent({ ...event, eventType: 'email.complained' })
    ).resolves.toBe(false)

    const rows = await resendRows()
    expect(rows).toEqual([{ ...event, processedAt: expect.any(Date) }])
    expectRecent(rows[0]?.processedAt, since)
  })

  it('stores a null email id when none is given', async () => {
    await claimResendWebhookEvent({ id: 'msg_456', eventType: 'email.sent' })

    expect(await resendRows()).toEqual([
      { id: 'msg_456', emailId: null, eventType: 'email.sent', processedAt: expect.any(Date) },
    ])
  })
})
