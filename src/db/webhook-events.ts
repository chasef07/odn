import prisma from './client'
import { isUniqueConstraintError } from './errors'

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
  return prisma.telnyxWebhookEvent.findUnique({
    where: { id },
    select: { id: true, status: true, processedAt: true },
  })
}

export async function recordProcessedTelnyxEvent({
  id,
  eventType,
  occurredAt,
}: TelnyxEvent): Promise<void> {
  try {
    await prisma.telnyxWebhookEvent.create({
      data: {
        id,
        eventType,
        occurredAt,
        status: TELNYX_EVENT_STATUS.PROCESSED,
        lastError: null,
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) return
    throw error
  }
}

export async function insertProcessingTelnyxEvent(
  { id, eventType, occurredAt }: TelnyxEvent,
  claimedAt: Date
): Promise<boolean> {
  try {
    await prisma.telnyxWebhookEvent.create({
      data: {
        id,
        eventType,
        occurredAt,
        status: TELNYX_EVENT_STATUS.PROCESSING,
        lastError: null,
        processedAt: claimedAt,
      },
    })
    return true
  } catch (error) {
    if (isUniqueConstraintError(error)) return false
    throw error
  }
}

export async function reclaimTelnyxEvent(
  { id, eventType, occurredAt }: TelnyxEvent,
  { claimedAt, staleBefore }: { claimedAt: Date; staleBefore: Date }
): Promise<number> {
  const claimed = await prisma.telnyxWebhookEvent.updateMany({
    where: {
      id,
      OR: [
        { status: TELNYX_EVENT_STATUS.FAILED },
        {
          status: TELNYX_EVENT_STATUS.PROCESSING,
          processedAt: { lte: staleBefore },
        },
      ],
    },
    data: {
      eventType,
      occurredAt,
      status: TELNYX_EVENT_STATUS.PROCESSING,
      lastError: null,
      processedAt: claimedAt,
    },
  })
  return claimed.count
}

export async function markTelnyxEventProcessed(eventId: string): Promise<void> {
  await prisma.telnyxWebhookEvent.updateMany({
    where: { id: eventId },
    data: {
      status: TELNYX_EVENT_STATUS.PROCESSED,
      lastError: null,
      processedAt: new Date(),
    },
  })
}

export async function markTelnyxEventFailed(eventId: string, error: unknown): Promise<void> {
  await prisma.telnyxWebhookEvent.updateMany({
    where: { id: eventId },
    data: {
      status: TELNYX_EVENT_STATUS.FAILED,
      lastError: error instanceof Error ? error.message : 'Unknown support routing error',
      processedAt: new Date(),
    },
  })
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
  try {
    await prisma.resendWebhookEvent.create({
      data: {
        id,
        emailId,
        eventType,
      },
    })
    return true
  } catch (error) {
    if (isUniqueConstraintError(error)) return false
    throw error
  }
}
