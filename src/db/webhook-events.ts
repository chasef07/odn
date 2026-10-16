import { db } from './pool'
import { sql } from './sql'
import { insert, select, set } from './table'
import { resendWebhookEvents, telnyxWebhookEvents } from './tables'

export const TELNYX_EVENT_STATUS = {
  PROCESSED: 'PROCESSED',
  PROCESSING: 'PROCESSING',
  FAILED: 'FAILED',
} as const

export type TelnyxEvent = {
  id: string
  eventType: string
  occurredAt: Date
}

export type TelnyxEventClaim = {
  id: string
  status: string
  processedAt: Date
}

export async function findTelnyxEventClaim(id: string): Promise<TelnyxEventClaim | null> {
  return db.one(
    sql`SELECT ${select(telnyxWebhookEvents, ['id', 'status', 'processedAt'])} FROM telnyx_webhook_events WHERE id = ${id}`
  )
}

export async function recordProcessedTelnyxEvent({
  id,
  eventType,
  occurredAt,
}: TelnyxEvent): Promise<void> {
  await db.affected(
    sql`${insert(telnyxWebhookEvents, {
      id,
      eventType,
      occurredAt,
      status: TELNYX_EVENT_STATUS.PROCESSED,
      lastError: null,
    })} ON CONFLICT DO NOTHING`
  )
}

export async function insertProcessingTelnyxEvent(
  { id, eventType, occurredAt }: TelnyxEvent,
  claimedAt: Date
): Promise<boolean> {
  const inserted = await db.affected(
    sql`${insert(telnyxWebhookEvents, {
      id,
      eventType,
      occurredAt,
      status: TELNYX_EVENT_STATUS.PROCESSING,
      lastError: null,
      processedAt: claimedAt,
    })} ON CONFLICT DO NOTHING`
  )
  return inserted === 1
}

export async function reclaimTelnyxEvent(
  { id, eventType, occurredAt }: TelnyxEvent,
  { claimedAt, staleBefore }: { claimedAt: Date; staleBefore: Date }
): Promise<number> {
  return db.affected(
    sql`UPDATE telnyx_webhook_events SET ${set(telnyxWebhookEvents, {
      eventType,
      occurredAt,
      status: TELNYX_EVENT_STATUS.PROCESSING,
      lastError: null,
      processedAt: claimedAt,
    })} WHERE id = ${id} AND (status = ${TELNYX_EVENT_STATUS.FAILED} OR (status = ${TELNYX_EVENT_STATUS.PROCESSING} AND processed_at <= ${staleBefore}))`
  )
}

export async function markTelnyxEventProcessed(eventId: string): Promise<void> {
  await db.affected(
    sql`UPDATE telnyx_webhook_events SET ${set(telnyxWebhookEvents, {
      status: TELNYX_EVENT_STATUS.PROCESSED,
      lastError: null,
      processedAt: new Date(),
    })} WHERE id = ${eventId}`
  )
}

export async function markTelnyxEventFailed(eventId: string, error: unknown): Promise<void> {
  await db.affected(
    sql`UPDATE telnyx_webhook_events SET ${set(telnyxWebhookEvents, {
      status: TELNYX_EVENT_STATUS.FAILED,
      lastError: error instanceof Error ? error.message : 'Unknown support routing error',
      processedAt: new Date(),
    })} WHERE id = ${eventId}`
  )
}

export async function claimResendWebhookEvent({
  id,
  emailId,
  eventType,
}: {
  id: string
  emailId?: string
  eventType: string
}): Promise<boolean> {
  const inserted = await db.affected(
    sql`${insert(resendWebhookEvents, { id, emailId, eventType })} ON CONFLICT DO NOTHING`
  )
  return inserted === 1
}
