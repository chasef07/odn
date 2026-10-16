import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isLocalOptOut, isOptInKeyword, verifyTelnyxWebhookSignature } from '@/lib/telnyx'
import { handleInboundSupportSms } from '@/lib/sms-support'
import {
  countSmsOptedInSubmissionsForPhone,
  findLatestSubmissionIdForInboundSmsPhone,
} from '@/db/submissions'
import {
  findSmsMessageSupportHandledAt,
  findSmsPhoneConsentState,
  markSmsMessageSupportHandled,
  recordSmsMessageFinalized,
  recordSmsMessageSent,
  recordSmsPhoneOptIn,
  recordSmsPhoneOptOut,
  upsertInboundSmsMessage,
} from '@/db/sms-support'
import {
  findTelnyxEventClaim,
  insertProcessingTelnyxEvent,
  markTelnyxEventFailed,
  markTelnyxEventProcessed,
  reclaimTelnyxEvent,
  recordProcessedTelnyxEvent,
  TELNYX_EVENT_STATUS,
  type TelnyxEventClaim,
} from '@/db/webhook-events'

type TelnyxWebhookEvent = {
  data?: {
    event_type?: string
    id?: string
    occurred_at?: string
    payload?: TelnyxMessagePayload
  }
}

type TelnyxMessagePayload = {
  id?: string
  direction?: string
  from?: { phone_number?: string; status?: string }
  to?: Array<{ phone_number?: string; status?: string }>
  text?: string
  sent_at?: string | null
  received_at?: string | null
  completed_at?: string | null
  errors?: Array<{ code?: string; title?: string; detail?: string }>
}

type SupportRouteInput = {
  fromPhone: string
  body: string
  providerMessageId: string
  receivedAt: Date
}

const TELNYX_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  if (!env.TELNYX_WEBHOOK_ENABLED) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('telnyx-signature-ed25519')
  const timestamp = request.headers.get('telnyx-timestamp')

  const isValidSignature = verifyTelnyxWebhookSignature({
    rawBody,
    signature,
    timestamp,
    publicKey: env.TELNYX_PUBLIC_KEY,
  })

  if (!isValidSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: TelnyxWebhookEvent
  try {
    event = JSON.parse(rawBody) as TelnyxWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data = event.data
  if (!data?.id || !data.event_type || !data.occurred_at) {
    return NextResponse.json({ error: 'Invalid Telnyx event' }, { status: 400 })
  }

  const existingEvent = await findTelnyxEventClaim(data.id)

  if (existingEvent?.status === TELNYX_EVENT_STATUS.PROCESSED) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  let shouldRecordEvent = true
  switch (data.event_type) {
    case 'message.received':
      {
        const supportRoute = await handleMessageReceived(data.payload, data.occurred_at)
        if (supportRoute) {
          const claimStatus = await claimTelnyxEventForSupport(data, existingEvent)
          if (claimStatus === 'processed') {
            return NextResponse.json({ received: true }, { status: 200 })
          }
          if (claimStatus === 'busy') {
            return NextResponse.json({ error: 'Telnyx event already processing' }, { status: 500 })
          }

          try {
            if (await isSupportMessageHandled(supportRoute.providerMessageId)) {
              await markTelnyxEventProcessed(data.id)
              return NextResponse.json({ received: true }, { status: 200 })
            }

            await markSmsMessageSupportHandled(supportRoute.providerMessageId)
            await handleInboundSupportSms(supportRoute)
            await markTelnyxEventProcessed(data.id)
          } catch (error) {
            await markTelnyxEventFailed(data.id, error)
            throw error
          }

          return NextResponse.json({ received: true }, { status: 200 })
        }
      }
      break
    case 'message.sent':
      await handleMessageSent(data.payload, data.occurred_at)
      break
    case 'message.finalized':
      shouldRecordEvent = await handleMessageFinalized(data.payload, data.occurred_at)
      break
  }

  if (!shouldRecordEvent) {
    return NextResponse.json({ error: 'SMS message not found for receipt' }, { status: 500 })
  }

  await recordProcessedTelnyxEvent({
    id: data.id,
    eventType: data.event_type,
    occurredAt: new Date(data.occurred_at),
  })

  return NextResponse.json({ received: true }, { status: 200 })
}

async function handleMessageReceived(
  payload: TelnyxMessagePayload | undefined,
  occurredAt: string
): Promise<SupportRouteInput | undefined> {
  if (!payload?.id) return

  const from = payload.from?.phone_number || null
  const to = payload.to?.[0]?.phone_number || null
  const body = payload.text || ''
  const eventAt = parseDate(occurredAt) || new Date()
  const receivedAt = parseDate(payload.received_at) || eventAt
  const submission = from ? await findLatestSubmissionIdForInboundSmsPhone(from) : null

  await upsertInboundSmsMessage({
    providerMessageId: payload.id,
    submissionId: submission?.id,
    to,
    from,
    body,
    providerStatus: payload.from?.status || payload.to?.[0]?.status,
    receivedAt,
  })

  if (!from) return

  if (isLocalOptOut(body)) {
    await applyInboundOptOut(from, eventAt)
    return
  }

  if (isOptInKeyword(body)) {
    const hasPriorOptIn = await countSmsOptedInSubmissionsForPhone(from)

    if (hasPriorOptIn > 0) {
      await applyInboundOptIn(from, eventAt)
    }
    return
  }

  return {
    fromPhone: from,
    body,
    providerMessageId: payload.id,
    receivedAt,
  }
}

async function applyInboundOptOut(phoneE164: string, occurredAt: Date) {
  const phoneState = await findSmsPhoneConsentState(phoneE164)

  if (phoneState?.optedOutAt && phoneState.optedOutAt > occurredAt) return
  if (phoneState?.lastOptInAt && phoneState.lastOptInAt > occurredAt) return

  await recordSmsPhoneOptOut(phoneE164, occurredAt)
}

async function applyInboundOptIn(phoneE164: string, occurredAt: Date) {
  const phoneState = await findSmsPhoneConsentState(phoneE164)

  if (phoneState?.optedOutAt && phoneState.optedOutAt > occurredAt) return
  if (phoneState?.lastOptInAt && phoneState.lastOptInAt > occurredAt) return

  await recordSmsPhoneOptIn(phoneE164, occurredAt)
}

async function handleMessageSent(payload: TelnyxMessagePayload | undefined, occurredAt: string) {
  if (!payload?.id) return

  await recordSmsMessageSent(payload.id, {
    providerStatus: payload.to?.[0]?.status || 'sent',
    sentAt: parseDate(payload.sent_at) || new Date(occurredAt),
  })
}

async function handleMessageFinalized(
  payload: TelnyxMessagePayload | undefined,
  occurredAt: string
): Promise<boolean> {
  if (!payload?.id) return true

  const error = payload.errors?.[0]
  const finalizedCount = await recordSmsMessageFinalized(payload.id, {
    providerStatus: payload.to?.[0]?.status || 'delivery_unconfirmed',
    errorCode: error?.code || null,
    errorMessage: error?.detail || error?.title || null,
    finalizedAt: parseDate(payload.completed_at) || new Date(occurredAt),
  })
  return finalizedCount > 0
}

async function isSupportMessageHandled(providerMessageId: string): Promise<boolean> {
  const message = await findSmsMessageSupportHandledAt(providerMessageId)

  return !!message?.supportHandledAt
}

async function claimTelnyxEventForSupport(
  data: NonNullable<TelnyxWebhookEvent['data']>,
  existingEvent: TelnyxEventClaim | null
): Promise<'claimed' | 'processed' | 'busy'> {
  if (existingEvent?.status === TELNYX_EVENT_STATUS.PROCESSED) return 'processed'

  const now = new Date()
  const staleBefore = new Date(now.getTime() - TELNYX_PROCESSING_TIMEOUT_MS)
  const telnyxEvent = {
    id: data.id!,
    eventType: data.event_type!,
    occurredAt: new Date(data.occurred_at!),
  }

  if (existingEvent) {
    const canRetry =
      existingEvent.status === TELNYX_EVENT_STATUS.FAILED ||
      (existingEvent.status === TELNYX_EVENT_STATUS.PROCESSING &&
        existingEvent.processedAt <= staleBefore)
    if (!canRetry) return 'busy'

    const claimed = await reclaimTelnyxEvent(telnyxEvent, { claimedAt: now, staleBefore })

    return claimed === 1 ? 'claimed' : 'busy'
  }

  return (await insertProcessingTelnyxEvent(telnyxEvent, now)) ? 'claimed' : 'busy'
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
