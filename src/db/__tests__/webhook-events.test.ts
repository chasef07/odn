import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockTelnyxFindUnique, mockTelnyxCreate, mockTelnyxUpdateMany, mockResendCreate } =
  vi.hoisted(() => ({
    mockTelnyxFindUnique: vi.fn(),
    mockTelnyxCreate: vi.fn(),
    mockTelnyxUpdateMany: vi.fn(),
    mockResendCreate: vi.fn(),
  }))

vi.mock('../client', () => ({
  default: {
    telnyxWebhookEvent: {
      findUnique: mockTelnyxFindUnique,
      create: mockTelnyxCreate,
      updateMany: mockTelnyxUpdateMany,
    },
    resendWebhookEvent: {
      create: mockResendCreate,
    },
  },
}))

import {
  claimResendWebhookEvent,
  findTelnyxEventClaim,
  insertProcessingTelnyxEvent,
  markTelnyxEventFailed,
  markTelnyxEventProcessed,
  reclaimTelnyxEvent,
  recordProcessedTelnyxEvent,
} from '../webhook-events'

const occurredAt = new Date('2026-06-16T12:00:00.000Z')
const telnyxEvent = {
  id: 'evt_message_received',
  eventType: 'message.received',
  occurredAt,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('findTelnyxEventClaim', () => {
  it('reads the claim columns of the event by id', async () => {
    const claim = { id: 'evt_1', status: 'FAILED', processedAt: occurredAt }
    mockTelnyxFindUnique.mockResolvedValue(claim)

    await expect(findTelnyxEventClaim('evt_1')).resolves.toEqual(claim)
    expect(mockTelnyxFindUnique).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      select: { id: true, status: true, processedAt: true },
    })
  })

  it('returns null when the event was never seen', async () => {
    mockTelnyxFindUnique.mockResolvedValue(null)

    await expect(findTelnyxEventClaim('evt_missing')).resolves.toBeNull()
  })
})

describe('recordProcessedTelnyxEvent', () => {
  it('inserts the event as processed', async () => {
    mockTelnyxCreate.mockResolvedValue({})

    await recordProcessedTelnyxEvent(telnyxEvent)

    expect(mockTelnyxCreate).toHaveBeenCalledWith({
      data: {
        id: 'evt_message_received',
        eventType: 'message.received',
        occurredAt,
        status: 'PROCESSED',
        lastError: null,
      },
    })
  })

  it('treats a duplicate event id as already recorded', async () => {
    mockTelnyxCreate.mockRejectedValue({ code: 'P2002' })

    await expect(recordProcessedTelnyxEvent(telnyxEvent)).resolves.toBeUndefined()
  })

  it('rethrows other errors', async () => {
    mockTelnyxCreate.mockRejectedValue(new Error('connection lost'))

    await expect(recordProcessedTelnyxEvent(telnyxEvent)).rejects.toThrow('connection lost')
  })
})

describe('insertProcessingTelnyxEvent', () => {
  it('claims a new event as processing and reports the claim', async () => {
    const claimedAt = new Date('2026-06-16T12:00:05.000Z')
    mockTelnyxCreate.mockResolvedValue({})

    await expect(insertProcessingTelnyxEvent(telnyxEvent, claimedAt)).resolves.toBe(true)
    expect(mockTelnyxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'evt_message_received',
        status: 'PROCESSING',
        lastError: null,
      }),
    })
  })

  it('stores the event fields and the claim time', async () => {
    const claimedAt = new Date('2026-06-16T12:00:05.000Z')
    mockTelnyxCreate.mockResolvedValue({})

    await insertProcessingTelnyxEvent(telnyxEvent, claimedAt)

    expect(mockTelnyxCreate).toHaveBeenCalledWith({
      data: {
        id: 'evt_message_received',
        eventType: 'message.received',
        occurredAt,
        status: 'PROCESSING',
        lastError: null,
        processedAt: claimedAt,
      },
    })
  })

  it('returns false when a concurrent duplicate event wins the claim', async () => {
    mockTelnyxCreate.mockRejectedValue({ code: 'P2002' })

    await expect(insertProcessingTelnyxEvent(telnyxEvent, new Date())).resolves.toBe(false)
  })

  it('rethrows other errors', async () => {
    mockTelnyxCreate.mockRejectedValue(new Error('connection lost'))

    await expect(insertProcessingTelnyxEvent(telnyxEvent, new Date())).rejects.toThrow(
      'connection lost'
    )
  })
})

describe('reclaimTelnyxEvent', () => {
  it('reclaims only failed or stale processing events and returns the claimed count', async () => {
    const claimedAt = new Date('2026-06-16T12:20:00.000Z')
    const staleBefore = new Date('2026-06-16T12:05:00.000Z')
    mockTelnyxUpdateMany.mockResolvedValue({ count: 1 })

    await expect(reclaimTelnyxEvent(telnyxEvent, { claimedAt, staleBefore })).resolves.toBe(1)
    expect(mockTelnyxUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'evt_message_received',
        OR: [
          { status: 'FAILED' },
          {
            status: 'PROCESSING',
            processedAt: { lte: staleBefore },
          },
        ],
      },
      data: {
        eventType: 'message.received',
        occurredAt,
        status: 'PROCESSING',
        lastError: null,
        processedAt: claimedAt,
      },
    })
  })

  it('returns 0 when another worker holds the claim', async () => {
    mockTelnyxUpdateMany.mockResolvedValue({ count: 0 })

    await expect(
      reclaimTelnyxEvent(telnyxEvent, { claimedAt: new Date(), staleBefore: new Date() })
    ).resolves.toBe(0)
  })
})

describe('markTelnyxEventProcessed', () => {
  it('marks the event processed and clears the last error', async () => {
    mockTelnyxUpdateMany.mockResolvedValue({ count: 1 })

    await markTelnyxEventProcessed('evt_message_received')

    expect(mockTelnyxUpdateMany).toHaveBeenCalledWith({
      where: { id: 'evt_message_received' },
      data: expect.objectContaining({
        status: 'PROCESSED',
        lastError: null,
      }),
    })
  })

  it('stamps the processed time', async () => {
    mockTelnyxUpdateMany.mockResolvedValue({ count: 1 })

    await markTelnyxEventProcessed('evt_message_received')

    expect(mockTelnyxUpdateMany).toHaveBeenCalledWith({
      where: { id: 'evt_message_received' },
      data: {
        status: 'PROCESSED',
        lastError: null,
        processedAt: expect.any(Date),
      },
    })
  })
})

describe('markTelnyxEventFailed', () => {
  it('marks the event failed with the error message', async () => {
    mockTelnyxUpdateMany.mockResolvedValue({ count: 1 })

    await markTelnyxEventFailed('evt_message_received', new Error('support route failed'))

    expect(mockTelnyxUpdateMany).toHaveBeenCalledWith({
      where: { id: 'evt_message_received' },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'support route failed',
      }),
    })
  })

  it('stamps the failure time', async () => {
    mockTelnyxUpdateMany.mockResolvedValue({ count: 1 })

    await markTelnyxEventFailed('evt_message_received', new Error('support route failed'))

    expect(mockTelnyxUpdateMany).toHaveBeenCalledWith({
      where: { id: 'evt_message_received' },
      data: {
        status: 'FAILED',
        lastError: 'support route failed',
        processedAt: expect.any(Date),
      },
    })
  })

  it('records a generic message when the thrown value is not an Error', async () => {
    mockTelnyxUpdateMany.mockResolvedValue({ count: 1 })

    await markTelnyxEventFailed('evt_message_received', 'boom')

    expect(mockTelnyxUpdateMany).toHaveBeenCalledWith({
      where: { id: 'evt_message_received' },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'Unknown support routing error',
      }),
    })
  })
})

describe('claimResendWebhookEvent', () => {
  it('inserts the event and reports the claim', async () => {
    mockResendCreate.mockResolvedValue({})

    await expect(
      claimResendWebhookEvent({
        id: 'msg_123',
        emailId: 'email_123',
        eventType: 'email.bounced',
      })
    ).resolves.toBe(true)
    expect(mockResendCreate).toHaveBeenCalledWith({
      data: {
        id: 'msg_123',
        emailId: 'email_123',
        eventType: 'email.bounced',
      },
    })
  })

  it('returns false for a duplicate event id', async () => {
    mockResendCreate.mockRejectedValue({ code: 'P2002' })

    await expect(
      claimResendWebhookEvent({ id: 'msg_123', emailId: 'email_123', eventType: 'email.bounced' })
    ).resolves.toBe(false)
  })

  it('rethrows other errors', async () => {
    mockResendCreate.mockRejectedValue(new Error('connection lost'))

    await expect(
      claimResendWebhookEvent({ id: 'msg_123', emailId: 'email_123', eventType: 'email.bounced' })
    ).rejects.toThrow('connection lost')
  })
})
