import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSmsPhoneStateFindUnique, mockSmsSupportTicketUpdateMany, mockSendTelnyxSms } =
  vi.hoisted(() => ({
    mockSmsPhoneStateFindUnique: vi.fn(),
    mockSmsSupportTicketUpdateMany: vi.fn(),
    mockSendTelnyxSms: vi.fn(),
  }))

vi.mock('@/lib/prisma', () => ({
  default: {
    smsPhoneState: {
      findUnique: mockSmsPhoneStateFindUnique,
    },
    smsSupportTicket: {
      updateMany: mockSmsSupportTicketUpdateMany,
    },
  },
}))

vi.mock('@/lib/telnyx', () => ({
  sendTelnyxSms: mockSendTelnyxSms,
}))

import { sendSupportSms } from '../sms-support-sms'

describe('sendSupportSms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSmsPhoneStateFindUnique.mockResolvedValue(null)
    mockSendTelnyxSms.mockResolvedValue({ success: true })
    mockSmsSupportTicketUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('adds opt-out copy to raw support replies at the send boundary', async () => {
    const result = await sendSupportSms({
      ticketId: 'ticket_123',
      submissionId: 'sub_123',
      toPhone: '+15551234567',
      type: 'SUPPORT_REPLY',
      body: 'We are checking this now.',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendTelnyxSms).toHaveBeenCalledWith(
      expect.objectContaining({
        supportTicketId: 'ticket_123',
        submissionId: 'sub_123',
        body: 'We are checking this now. STOP to opt out.',
      })
    )
  })

  it('does not duplicate existing opt-out copy', async () => {
    await sendSupportSms({
      ticketId: 'ticket_123',
      toPhone: '+15551234567',
      body: 'Thanks. STOP to opt out.',
    })

    expect(mockSendTelnyxSms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Thanks. STOP to opt out.',
      })
    )
  })
})
