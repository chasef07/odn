import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSmsPhoneStateFindUnique,
  mockSmsSupportTicketFindUnique,
  mockSmsSupportTicketUpdateMany,
  mockSendTelnyxSms,
} = vi.hoisted(() => ({
  mockSmsPhoneStateFindUnique: vi.fn(),
  mockSmsSupportTicketFindUnique: vi.fn(),
  mockSmsSupportTicketUpdateMany: vi.fn(),
  mockSendTelnyxSms: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    smsPhoneState: {
      findUnique: mockSmsPhoneStateFindUnique,
    },
    smsSupportTicket: {
      findUnique: mockSmsSupportTicketFindUnique,
      updateMany: mockSmsSupportTicketUpdateMany,
    },
  },
}))

vi.mock('@/lib/telnyx', () => ({
  sendTelnyxSms: mockSendTelnyxSms,
}))

import { sendSupportSms } from '../sms-support-sms'
import { supportIntroMenuSms } from '../sms-support-templates'

describe('sendSupportSms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSmsPhoneStateFindUnique.mockResolvedValue(null)
    mockSmsSupportTicketFindUnique.mockResolvedValue({ lastOutboundAt: null })
    mockSendTelnyxSms.mockResolvedValue({ success: true })
    mockSmsSupportTicketUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('sends the exact HELP intro with the long footer on a ticket first outbound', async () => {
    const result = await sendSupportSms({
      ticketId: 'ticket_123',
      submissionId: 'sub_123',
      toPhone: '+15551234567',
      type: 'SUPPORT_REPLY',
      body: supportIntroMenuSms(),
    })

    expect(result).toEqual({ success: true })
    expect(mockSendTelnyxSms).toHaveBeenCalledWith(
      expect.objectContaining({
        supportTicketId: 'ticket_123',
        submissionId: 'sub_123',
        body: [
          'How can we help? Reply with a number.',
          '1 I did not receive my note',
          '2 I need to change my note',
          '3 Other',
          'Reply HELP for note changes or customer support.',
          'STOP to opt out.',
        ].join('\n'),
      })
    )
  })

  it('omits the long footer after the ticket has a successful outbound', async () => {
    mockSmsSupportTicketFindUnique.mockResolvedValue({
      lastOutboundAt: new Date('2026-08-12T00:00:00Z'),
    })

    await sendSupportSms({
      ticketId: 'ticket_123',
      toPhone: '+15551234567',
      type: 'SUPPORT_AUTOMATION_UPDATE',
      body: 'We are still processing that update.',
    })

    expect(mockSendTelnyxSms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'We are still processing that update.',
      })
    )
  })

  it('keeps the footer eligible when the first send fails', async () => {
    mockSendTelnyxSms
      .mockResolvedValueOnce({ success: false, error: 'Telnyx unavailable' })
      .mockResolvedValueOnce({ success: true })

    const input = {
      ticketId: 'ticket_123',
      toPhone: '+15551234567',
      body: 'We are checking this now.',
    }

    await sendSupportSms(input)
    await sendSupportSms(input)

    const expectedBody = [
      'We are checking this now.',
      'Reply HELP for note changes or customer support.',
      'STOP to opt out.',
    ].join('\n')
    expect(mockSendTelnyxSms).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ body: expectedBody })
    )
    expect(mockSendTelnyxSms).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ body: expectedBody })
    )
    expect(mockSmsSupportTicketUpdateMany).toHaveBeenCalledTimes(1)
  })
})
