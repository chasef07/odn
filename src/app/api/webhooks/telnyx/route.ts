import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isLocalOptOut, isOptInKeyword, verifyTelnyxWebhookSignature } from '@/lib/telnyx'

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

export async function POST(request: NextRequest) {
  if (process.env.TELNYX_WEBHOOK_ENABLED === 'false') {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('telnyx-signature-ed25519')
  const timestamp = request.headers.get('telnyx-timestamp')

  const isValidSignature = verifyTelnyxWebhookSignature({
    rawBody,
    signature,
    timestamp,
    publicKey: process.env.TELNYX_PUBLIC_KEY,
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

  const existingEvent = await prisma.telnyxWebhookEvent.findUnique({
    where: { id: data.id },
    select: { id: true },
  })

  if (existingEvent) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  let shouldRecordEvent = true
  switch (data.event_type) {
    case 'message.received':
      await handleMessageReceived(data.payload, data.occurred_at)
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

  await prisma.telnyxWebhookEvent
    .create({
      data: {
        id: data.id,
        eventType: data.event_type,
        occurredAt: new Date(data.occurred_at),
      },
    })
    .catch((error: unknown) => {
      if (!isUniqueConstraintError(error)) throw error
    })

  return NextResponse.json({ received: true }, { status: 200 })
}

async function handleMessageReceived(
  payload: TelnyxMessagePayload | undefined,
  occurredAt: string
) {
  if (!payload?.id) return

  const from = payload.from?.phone_number || null
  const to = payload.to?.[0]?.phone_number || null
  const body = payload.text || ''
  const eventAt = parseDate(occurredAt) || new Date()
  const receivedAt = parseDate(payload.received_at) || eventAt
  const submission = from
    ? await prisma.submission.findFirst({
        where: { smsPhoneE164: from },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
    : null

  await prisma.smsMessage.upsert({
    where: { providerMessageId: payload.id },
    update: {
      providerStatus: payload.from?.status || payload.to?.[0]?.status,
      receivedAt,
    },
    create: {
      submissionId: submission?.id,
      type: 'INBOUND',
      direction: 'inbound',
      to,
      from,
      body,
      providerMessageId: payload.id,
      providerStatus: payload.from?.status || payload.to?.[0]?.status,
      receivedAt,
    },
  })

  if (!from) return

  if (isLocalOptOut(body)) {
    await applyInboundOptOut(from, eventAt)
    return
  }

  if (isOptInKeyword(body)) {
    const hasPriorOptIn = await prisma.submission.count({
      where: {
        smsPhoneE164: from,
        smsOptIn: true,
      },
    })

    if (hasPriorOptIn > 0) {
      await applyInboundOptIn(from, eventAt)
    }
  }
}

async function applyInboundOptOut(phoneE164: string, occurredAt: Date) {
  const phoneState = await prisma.smsPhoneState.findUnique({
    where: { phoneE164 },
    select: { optedOutAt: true, lastOptInAt: true },
  })

  if (phoneState?.optedOutAt && phoneState.optedOutAt > occurredAt) return
  if (phoneState?.lastOptInAt && phoneState.lastOptInAt > occurredAt) return

  await prisma.smsPhoneState.upsert({
    where: { phoneE164 },
    update: { optedOutAt: occurredAt },
    create: { phoneE164, optedOutAt: occurredAt },
  })
}

async function applyInboundOptIn(phoneE164: string, occurredAt: Date) {
  const phoneState = await prisma.smsPhoneState.findUnique({
    where: { phoneE164 },
    select: { optedOutAt: true, lastOptInAt: true },
  })

  if (phoneState?.optedOutAt && phoneState.optedOutAt > occurredAt) return
  if (phoneState?.lastOptInAt && phoneState.lastOptInAt > occurredAt) return

  await prisma.smsPhoneState.upsert({
    where: { phoneE164 },
    update: {
      optedOutAt: null,
      lastOptInAt: occurredAt,
    },
    create: {
      phoneE164,
      optedOutAt: null,
      lastOptInAt: occurredAt,
    },
  })
}

async function handleMessageSent(payload: TelnyxMessagePayload | undefined, occurredAt: string) {
  if (!payload?.id) return

  await prisma.smsMessage.updateMany({
    where: {
      providerMessageId: payload.id,
      finalizedAt: null,
    },
    data: {
      providerStatus: payload.to?.[0]?.status || 'sent',
      sentAt: parseDate(payload.sent_at) || new Date(occurredAt),
    },
  })
}

async function handleMessageFinalized(
  payload: TelnyxMessagePayload | undefined,
  occurredAt: string
): Promise<boolean> {
  if (!payload?.id) return true

  const error = payload.errors?.[0]
  const result = await prisma.smsMessage.updateMany({
    where: { providerMessageId: payload.id },
    data: {
      providerStatus: payload.to?.[0]?.status || 'delivery_unconfirmed',
      errorCode: error?.code || null,
      errorMessage: error?.detail || error?.title || null,
      finalizedAt: parseDate(payload.completed_at) || new Date(occurredAt),
    },
  })
  return result.count > 0
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}
