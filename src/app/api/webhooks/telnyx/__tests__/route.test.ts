import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockTelnyxWebhookFindUnique,
  mockTelnyxWebhookCreate,
  mockSmsMessageUpsert,
  mockSmsMessageUpdateMany,
  mockSmsPhoneStateFindUnique,
  mockSmsPhoneStateUpsert,
  mockSubmissionFindFirst,
  mockSubmissionCount,
} = vi.hoisted(() => ({
  mockTelnyxWebhookFindUnique: vi.fn(),
  mockTelnyxWebhookCreate: vi.fn(),
  mockSmsMessageUpsert: vi.fn(),
  mockSmsMessageUpdateMany: vi.fn(),
  mockSmsPhoneStateFindUnique: vi.fn(),
  mockSmsPhoneStateUpsert: vi.fn(),
  mockSubmissionFindFirst: vi.fn(),
  mockSubmissionCount: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    telnyxWebhookEvent: {
      findUnique: mockTelnyxWebhookFindUnique,
      create: mockTelnyxWebhookCreate,
    },
    smsMessage: {
      upsert: mockSmsMessageUpsert,
      updateMany: mockSmsMessageUpdateMany,
    },
    smsPhoneState: {
      findUnique: mockSmsPhoneStateFindUnique,
      upsert: mockSmsPhoneStateUpsert,
    },
    submission: {
      findFirst: mockSubmissionFindFirst,
      count: mockSubmissionCount,
    },
  },
}))

vi.mock('@/lib/telnyx', () => ({
  verifyTelnyxWebhookSignature: vi.fn(() => true),
  isLocalOptOut: (body: string) => body.trim().toUpperCase() === 'STOP',
  isOptInKeyword: (body: string) => ['START', 'UNSTOP'].includes(body.trim().toUpperCase()),
}))

import { POST } from '../route'

const occurredAt = '2026-06-16T12:00:00.000Z'

function buildRequest(eventType: string, payload: Record<string, unknown> = {}) {
  const event = {
    data: {
      id: `evt_${eventType.replace(/\W/g, '_')}`,
      event_type: eventType,
      occurred_at: occurredAt,
      payload: {
        id: 'msg_123',
        from: { phone_number: '+15551234567' },
        to: [{ phone_number: '+18885551212', status: 'sent' }],
        text: 'hello',
        sent_at: occurredAt,
        received_at: occurredAt,
        completed_at: occurredAt,
        ...payload,
      },
    },
  }

  return new NextRequest('http://localhost:3000/api/webhooks/telnyx', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: {
      'telnyx-signature-ed25519': 'signature',
      'telnyx-timestamp': String(Math.floor(Date.now() / 1000)),
    },
  })
}

describe('POST /api/webhooks/telnyx', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.TELNYX_WEBHOOK_ENABLED = 'true'
    vi.clearAllMocks()
    mockTelnyxWebhookFindUnique.mockResolvedValue(null)
    mockTelnyxWebhookCreate.mockResolvedValue({})
    mockSmsMessageUpsert.mockResolvedValue({})
    mockSmsMessageUpdateMany.mockResolvedValue({ count: 1 })
    mockSmsPhoneStateFindUnique.mockResolvedValue(null)
    mockSmsPhoneStateUpsert.mockResolvedValue({})
    mockSubmissionFindFirst.mockResolvedValue({ id: 'sub_123' })
    mockSubmissionCount.mockResolvedValue(1)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('does not record an event as processed when the handler fails', async () => {
    mockSmsPhoneStateUpsert.mockRejectedValue(new Error('state write failed'))

    await expect(POST(buildRequest('message.received', { text: 'STOP' }))).rejects.toThrow(
      'state write failed'
    )

    expect(mockTelnyxWebhookCreate).not.toHaveBeenCalled()
  })

  it('does not let late sent events overwrite finalized SMS state', async () => {
    const response = await POST(buildRequest('message.sent'))

    expect(response.status).toBe(200)
    expect(mockSmsMessageUpdateMany).toHaveBeenCalledWith({
      where: {
        providerMessageId: 'msg_123',
        finalizedAt: null,
      },
      data: {
        providerStatus: 'sent',
        sentAt: new Date(occurredAt),
      },
    })
    expect(mockSmsMessageUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockTelnyxWebhookCreate.mock.invocationCallOrder[0]
    )
  })

  it('skips already processed Telnyx events', async () => {
    mockTelnyxWebhookFindUnique.mockResolvedValue({ id: 'evt_message_sent' })

    const response = await POST(buildRequest('message.sent'))

    expect(response.status).toBe(200)
    expect(mockSmsMessageUpdateMany).not.toHaveBeenCalled()
    expect(mockTelnyxWebhookCreate).not.toHaveBeenCalled()
  })

  it('does not record unmatched finalized receipts as processed', async () => {
    mockSmsMessageUpdateMany.mockResolvedValue({ count: 0 })

    const response = await POST(buildRequest('message.finalized'))

    expect(response.status).toBe(500)
    expect(mockTelnyxWebhookCreate).not.toHaveBeenCalled()
  })

  it('records inbound opt-outs at the Telnyx event time', async () => {
    const response = await POST(buildRequest('message.received', { text: 'STOP' }))

    expect(response.status).toBe(200)
    expect(mockSmsPhoneStateFindUnique).toHaveBeenCalledWith({
      where: { phoneE164: '+15551234567' },
      select: { optedOutAt: true, lastOptInAt: true },
    })
    expect(mockSmsPhoneStateUpsert).toHaveBeenCalledWith({
      where: { phoneE164: '+15551234567' },
      update: { optedOutAt: new Date(occurredAt) },
      create: { phoneE164: '+15551234567', optedOutAt: new Date(occurredAt) },
    })
  })

  it('does not let older opt-outs move newer opt-out state backward', async () => {
    mockSmsPhoneStateFindUnique.mockResolvedValue({ optedOutAt: new Date('2026-06-16T12:05:00Z') })

    const response = await POST(buildRequest('message.received', { text: 'STOP' }))

    expect(response.status).toBe(200)
    expect(mockSmsPhoneStateUpsert).not.toHaveBeenCalled()
  })

  it('does not let stale opt-ins clear newer opt-outs', async () => {
    mockSmsPhoneStateFindUnique.mockResolvedValue({ optedOutAt: new Date('2026-06-16T12:05:00Z') })

    const response = await POST(buildRequest('message.received', { text: 'START' }))

    expect(response.status).toBe(200)
    expect(mockSmsPhoneStateUpsert).not.toHaveBeenCalled()
  })

  it('does not let older opt-ins move newer opt-in state backward', async () => {
    mockSmsPhoneStateFindUnique.mockResolvedValue({
      optedOutAt: null,
      lastOptInAt: new Date('2026-06-16T12:05:00Z'),
    })

    const response = await POST(buildRequest('message.received', { text: 'START' }))

    expect(response.status).toBe(200)
    expect(mockSmsPhoneStateFindUnique).toHaveBeenCalledWith({
      where: { phoneE164: '+15551234567' },
      select: { optedOutAt: true, lastOptInAt: true },
    })
    expect(mockSmsPhoneStateUpsert).not.toHaveBeenCalled()
  })
})
