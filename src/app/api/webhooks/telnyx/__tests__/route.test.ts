import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockFindTelnyxEventClaim,
  mockRecordProcessedTelnyxEvent,
  mockInsertProcessingTelnyxEvent,
  mockReclaimTelnyxEvent,
  mockMarkTelnyxEventProcessed,
  mockMarkTelnyxEventFailed,
  mockFindSmsMessageSupportHandledAt,
  mockUpsertInboundSmsMessage,
  mockRecordSmsMessageSent,
  mockRecordSmsMessageFinalized,
  mockMarkSmsMessageSupportHandled,
  mockFindSmsPhoneConsentState,
  mockRecordSmsPhoneOptOut,
  mockRecordSmsPhoneOptIn,
  mockFindLatestSubmissionIdForInboundSmsPhone,
  mockCountSmsOptedInSubmissionsForPhone,
  mockHandleInboundSupportSms,
} = vi.hoisted(() => ({
  mockFindTelnyxEventClaim: vi.fn(),
  mockRecordProcessedTelnyxEvent: vi.fn(),
  mockInsertProcessingTelnyxEvent: vi.fn(),
  mockReclaimTelnyxEvent: vi.fn(),
  mockMarkTelnyxEventProcessed: vi.fn(),
  mockMarkTelnyxEventFailed: vi.fn(),
  mockFindSmsMessageSupportHandledAt: vi.fn(),
  mockUpsertInboundSmsMessage: vi.fn(),
  mockRecordSmsMessageSent: vi.fn(),
  mockRecordSmsMessageFinalized: vi.fn(),
  mockMarkSmsMessageSupportHandled: vi.fn(),
  mockFindSmsPhoneConsentState: vi.fn(),
  mockRecordSmsPhoneOptOut: vi.fn(),
  mockRecordSmsPhoneOptIn: vi.fn(),
  mockFindLatestSubmissionIdForInboundSmsPhone: vi.fn(),
  mockCountSmsOptedInSubmissionsForPhone: vi.fn(),
  mockHandleInboundSupportSms: vi.fn(),
}))

vi.mock('@/db/webhook-events', () => ({
  TELNYX_EVENT_STATUS: {
    PROCESSED: 'PROCESSED',
    PROCESSING: 'PROCESSING',
    FAILED: 'FAILED',
  },
  findTelnyxEventClaim: mockFindTelnyxEventClaim,
  recordProcessedTelnyxEvent: mockRecordProcessedTelnyxEvent,
  insertProcessingTelnyxEvent: mockInsertProcessingTelnyxEvent,
  reclaimTelnyxEvent: mockReclaimTelnyxEvent,
  markTelnyxEventProcessed: mockMarkTelnyxEventProcessed,
  markTelnyxEventFailed: mockMarkTelnyxEventFailed,
}))

vi.mock('@/db/sms-support', () => ({
  findSmsMessageSupportHandledAt: mockFindSmsMessageSupportHandledAt,
  upsertInboundSmsMessage: mockUpsertInboundSmsMessage,
  recordSmsMessageSent: mockRecordSmsMessageSent,
  recordSmsMessageFinalized: mockRecordSmsMessageFinalized,
  markSmsMessageSupportHandled: mockMarkSmsMessageSupportHandled,
  findSmsPhoneConsentState: mockFindSmsPhoneConsentState,
  recordSmsPhoneOptOut: mockRecordSmsPhoneOptOut,
  recordSmsPhoneOptIn: mockRecordSmsPhoneOptIn,
}))

vi.mock('@/db/submissions', () => ({
  findLatestSubmissionIdForInboundSmsPhone: mockFindLatestSubmissionIdForInboundSmsPhone,
  countSmsOptedInSubmissionsForPhone: mockCountSmsOptedInSubmissionsForPhone,
}))

vi.mock('@/lib/telnyx', () => ({
  verifyTelnyxWebhookSignature: vi.fn(() => true),
  isLocalOptOut: (body: string) => body.trim().toUpperCase() === 'STOP',
  isOptInKeyword: (body: string) => ['START', 'UNSTOP'].includes(body.trim().toUpperCase()),
}))

vi.mock('@/lib/sms-support', () => ({
  handleInboundSupportSms: mockHandleInboundSupportSms,
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
    mockFindTelnyxEventClaim.mockResolvedValue(null)
    mockRecordProcessedTelnyxEvent.mockResolvedValue(undefined)
    mockInsertProcessingTelnyxEvent.mockResolvedValue(true)
    mockReclaimTelnyxEvent.mockResolvedValue(1)
    mockMarkTelnyxEventProcessed.mockResolvedValue(undefined)
    mockMarkTelnyxEventFailed.mockResolvedValue(undefined)
    mockFindSmsMessageSupportHandledAt.mockResolvedValue(null)
    mockUpsertInboundSmsMessage.mockResolvedValue(undefined)
    mockRecordSmsMessageSent.mockResolvedValue(undefined)
    mockRecordSmsMessageFinalized.mockResolvedValue(1)
    mockMarkSmsMessageSupportHandled.mockResolvedValue(undefined)
    mockFindSmsPhoneConsentState.mockResolvedValue(null)
    mockRecordSmsPhoneOptOut.mockResolvedValue(undefined)
    mockRecordSmsPhoneOptIn.mockResolvedValue(undefined)
    mockFindLatestSubmissionIdForInboundSmsPhone.mockResolvedValue({ id: 'sub_123' })
    mockCountSmsOptedInSubmissionsForPhone.mockResolvedValue(1)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('does not record an event as processed when the handler fails', async () => {
    mockRecordSmsPhoneOptOut.mockRejectedValue(new Error('state write failed'))

    await expect(POST(buildRequest('message.received', { text: 'STOP' }))).rejects.toThrow(
      'state write failed'
    )

    expect(mockRecordProcessedTelnyxEvent).not.toHaveBeenCalled()
    expect(mockInsertProcessingTelnyxEvent).not.toHaveBeenCalled()
  })

  it('does not let late sent events overwrite finalized SMS state', async () => {
    const response = await POST(buildRequest('message.sent'))

    expect(response.status).toBe(200)
    expect(mockRecordSmsMessageSent).toHaveBeenCalledWith('msg_123', {
      providerStatus: 'sent',
      sentAt: new Date(occurredAt),
    })
    expect(mockRecordSmsMessageSent.mock.invocationCallOrder[0]).toBeLessThan(
      mockRecordProcessedTelnyxEvent.mock.invocationCallOrder[0]
    )
  })

  it('skips already processed Telnyx events', async () => {
    mockFindTelnyxEventClaim.mockResolvedValue({
      id: 'evt_message_sent',
      status: 'PROCESSED',
      processedAt: new Date(occurredAt),
    })

    const response = await POST(buildRequest('message.sent'))

    expect(response.status).toBe(200)
    expect(mockRecordSmsMessageSent).not.toHaveBeenCalled()
    expect(mockRecordSmsMessageFinalized).not.toHaveBeenCalled()
    expect(mockMarkSmsMessageSupportHandled).not.toHaveBeenCalled()
    expect(mockRecordProcessedTelnyxEvent).not.toHaveBeenCalled()
    expect(mockInsertProcessingTelnyxEvent).not.toHaveBeenCalled()
  })

  it('does not record unmatched finalized receipts as processed', async () => {
    mockRecordSmsMessageFinalized.mockResolvedValue(0)

    const response = await POST(buildRequest('message.finalized'))

    expect(response.status).toBe(500)
    expect(mockRecordProcessedTelnyxEvent).not.toHaveBeenCalled()
    expect(mockInsertProcessingTelnyxEvent).not.toHaveBeenCalled()
  })

  it('records inbound opt-outs at the Telnyx event time', async () => {
    const response = await POST(buildRequest('message.received', { text: 'STOP' }))

    expect(response.status).toBe(200)
    expect(mockFindSmsPhoneConsentState).toHaveBeenCalledWith('+15551234567')
    expect(mockRecordSmsPhoneOptOut).toHaveBeenCalledWith('+15551234567', new Date(occurredAt))
    expect(mockHandleInboundSupportSms).not.toHaveBeenCalled()
  })

  it('does not let older opt-outs move newer opt-out state backward', async () => {
    mockFindSmsPhoneConsentState.mockResolvedValue({
      optedOutAt: new Date('2026-06-16T12:05:00Z'),
    })

    const response = await POST(buildRequest('message.received', { text: 'STOP' }))

    expect(response.status).toBe(200)
    expect(mockRecordSmsPhoneOptOut).not.toHaveBeenCalled()
    expect(mockRecordSmsPhoneOptIn).not.toHaveBeenCalled()
  })

  it('does not let stale opt-ins clear newer opt-outs', async () => {
    mockFindSmsPhoneConsentState.mockResolvedValue({
      optedOutAt: new Date('2026-06-16T12:05:00Z'),
    })

    const response = await POST(buildRequest('message.received', { text: 'START' }))

    expect(response.status).toBe(200)
    expect(mockRecordSmsPhoneOptOut).not.toHaveBeenCalled()
    expect(mockRecordSmsPhoneOptIn).not.toHaveBeenCalled()
  })

  it('does not let older opt-ins move newer opt-in state backward', async () => {
    mockFindSmsPhoneConsentState.mockResolvedValue({
      optedOutAt: null,
      lastOptInAt: new Date('2026-06-16T12:05:00Z'),
    })

    const response = await POST(buildRequest('message.received', { text: 'START' }))

    expect(response.status).toBe(200)
    expect(mockFindSmsPhoneConsentState).toHaveBeenCalledWith('+15551234567')
    expect(mockRecordSmsPhoneOptOut).not.toHaveBeenCalled()
    expect(mockRecordSmsPhoneOptIn).not.toHaveBeenCalled()
    expect(mockHandleInboundSupportSms).not.toHaveBeenCalled()
  })

  it('routes ordinary inbound SMS into support automation after recording the raw SMS', async () => {
    const response = await POST(buildRequest('message.received', { text: 'HELP' }))

    expect(response.status).toBe(200)
    expect(mockUpsertInboundSmsMessage).toHaveBeenCalledWith({
      providerMessageId: 'msg_123',
      submissionId: 'sub_123',
      to: '+18885551212',
      from: '+15551234567',
      body: 'HELP',
      providerStatus: 'sent',
      receivedAt: new Date(occurredAt),
    })
    expect(mockHandleInboundSupportSms).toHaveBeenCalledWith({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_123',
      receivedAt: new Date(occurredAt),
    })
    expect(mockInsertProcessingTelnyxEvent).toHaveBeenCalledWith(
      {
        id: 'evt_message_received',
        eventType: 'message.received',
        occurredAt: new Date(occurredAt),
      },
      expect.any(Date)
    )
    expect(mockInsertProcessingTelnyxEvent.mock.invocationCallOrder[0]).toBeLessThan(
      mockHandleInboundSupportSms.mock.invocationCallOrder[0]
    )
    expect(mockMarkSmsMessageSupportHandled.mock.invocationCallOrder[0]).toBeLessThan(
      mockHandleInboundSupportSms.mock.invocationCallOrder[0]
    )
    expect(mockMarkTelnyxEventProcessed).toHaveBeenLastCalledWith('evt_message_received')
    expect(mockMarkTelnyxEventFailed).not.toHaveBeenCalled()
    expect(mockMarkSmsMessageSupportHandled).toHaveBeenCalledWith('msg_123')
  })

  it('does not rerun support routing when a failed Telnyx event already handled that inbound SMS', async () => {
    mockFindTelnyxEventClaim.mockResolvedValue({
      id: 'evt_message_received',
      status: 'FAILED',
      processedAt: new Date(occurredAt),
    })
    mockFindSmsMessageSupportHandledAt.mockResolvedValue({
      supportHandledAt: new Date('2026-06-16T12:01:00Z'),
    })

    const response = await POST(buildRequest('message.received', { text: 'HELP' }))

    expect(response.status).toBe(200)
    expect(mockUpsertInboundSmsMessage).toHaveBeenCalled()
    expect(mockHandleInboundSupportSms).not.toHaveBeenCalled()
    expect(mockMarkTelnyxEventProcessed).toHaveBeenLastCalledWith('evt_message_received')
    expect(mockReclaimTelnyxEvent.mock.invocationCallOrder[0]).toBeLessThan(
      mockMarkTelnyxEventProcessed.mock.invocationCallOrder[0]
    )
    expect(mockMarkTelnyxEventFailed).not.toHaveBeenCalled()
  })

  it('does not replay ordinary inbound support events when support routing fails after handling starts', async () => {
    mockHandleInboundSupportSms.mockRejectedValue(new Error('support route failed'))

    await expect(POST(buildRequest('message.received', { text: 'HELP' }))).rejects.toThrow(
      'support route failed'
    )

    expect(mockInsertProcessingTelnyxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt_message_received',
      }),
      expect.any(Date)
    )
    expect(mockMarkTelnyxEventFailed).toHaveBeenLastCalledWith(
      'evt_message_received',
      new Error('support route failed')
    )
    expect(mockMarkTelnyxEventProcessed).not.toHaveBeenCalled()
    expect(mockMarkSmsMessageSupportHandled).toHaveBeenCalledWith('msg_123')
    expect(mockMarkSmsMessageSupportHandled.mock.invocationCallOrder[0]).toBeLessThan(
      mockHandleInboundSupportSms.mock.invocationCallOrder[0]
    )
  })

  it('does not route support twice when a concurrent duplicate event is already processing', async () => {
    mockFindTelnyxEventClaim.mockResolvedValue({
      id: 'evt_message_received',
      status: 'PROCESSING',
      processedAt: new Date(),
    })

    const response = await POST(buildRequest('message.received', { text: 'HELP' }))

    expect(response.status).toBe(500)
    expect(mockUpsertInboundSmsMessage).toHaveBeenCalled()
    expect(mockHandleInboundSupportSms).not.toHaveBeenCalled()
  })

  it('does not route support twice when a concurrent duplicate event wins the claim', async () => {
    mockInsertProcessingTelnyxEvent.mockResolvedValue(false)

    const response = await POST(buildRequest('message.received', { text: 'HELP' }))

    expect(response.status).toBe(500)
    expect(mockUpsertInboundSmsMessage).toHaveBeenCalled()
    expect(mockHandleInboundSupportSms).not.toHaveBeenCalled()
  })
})
