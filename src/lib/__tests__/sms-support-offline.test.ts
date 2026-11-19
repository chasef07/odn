import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockClaimOfflineNotice,
  mockFindOfflineNoticePausedUntil,
  mockFindSmsPhoneOptOut,
  mockFindSupportTicketLastOutboundAt,
  mockRecordSupportTicketOutbound,
  mockSendTelnyxSms,
} = vi.hoisted(() => ({
  mockClaimOfflineNotice: vi.fn(),
  mockFindOfflineNoticePausedUntil: vi.fn(),
  mockFindSmsPhoneOptOut: vi.fn(),
  mockFindSupportTicketLastOutboundAt: vi.fn(),
  mockRecordSupportTicketOutbound: vi.fn(),
  mockSendTelnyxSms: vi.fn(),
}))

vi.mock('@/db/sms-offline-notice', () => ({
  claimOfflineNotice: mockClaimOfflineNotice,
  findOfflineNoticePausedUntil: mockFindOfflineNoticePausedUntil,
}))

vi.mock('@/db/sms-support', () => ({
  findSmsPhoneOptOut: mockFindSmsPhoneOptOut,
  findSupportTicketLastOutboundAt: mockFindSupportTicketLastOutboundAt,
  recordSupportTicketOutbound: mockRecordSupportTicketOutbound,
}))

vi.mock('@/lib/telnyx', () => ({
  sendTelnyxSms: mockSendTelnyxSms,
}))

import { instantOf } from '../dates'
import { offlineNoticePauseEnd, sendOfflineNotice } from '../sms-support-offline'

const OFFLINE_TEXT =
  'Thank you for reaching out! Our team is currently offline and will respond as soon as possible in the morning. We appreciate your patience.'

const ticket = { id: 'ticket_123', phoneE164: '+15551234567', submissionId: 'sub_123' }

function at(iso: string) {
  return instantOf(new Date(iso))
}

describe('sendOfflineNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClaimOfflineNotice.mockResolvedValue(true)
    mockFindOfflineNoticePausedUntil.mockResolvedValue(null)
    mockFindSmsPhoneOptOut.mockResolvedValue(null)
    mockFindSupportTicketLastOutboundAt.mockResolvedValue({ lastOutboundAt: null })
    mockSendTelnyxSms.mockResolvedValue({ success: true })
  })

  it.each([
    ['12:00 AM', '2026-11-19T05:00:00Z', '2026-11-19'],
    ['3:30 AM', '2026-11-19T08:30:00Z', '2026-11-19'],
    ['6:59 AM', '2026-11-19T11:59:59Z', '2026-11-19'],
    ['6:59 AM in summer time', '2026-07-01T10:59:59Z', '2026-07-01'],
  ])(
    'sends the exact offline text, alone and on the ticket, at %s ET',
    async (_label, iso, night) => {
      await sendOfflineNotice(ticket, at(iso))

      expect(mockClaimOfflineNotice).toHaveBeenCalledWith(
        '+15551234567',
        new Date(`${night}T00:00:00.000Z`)
      )
      expect(mockSendTelnyxSms).toHaveBeenCalledTimes(1)
      expect(mockSendTelnyxSms).toHaveBeenCalledWith({
        submissionId: 'sub_123',
        supportTicketId: 'ticket_123',
        type: 'SUPPORT_OFFLINE_NOTICE',
        toPhone: '+15551234567',
        body: OFFLINE_TEXT,
      })
    }
  )

  it('leaves the ticket first-reply footer for the bot by not stamping the ticket outbound', async () => {
    await sendOfflineNotice(ticket, at('2026-11-19T08:30:00Z'))

    expect(mockFindSupportTicketLastOutboundAt).not.toHaveBeenCalled()
    expect(mockRecordSupportTicketOutbound).not.toHaveBeenCalled()
  })

  it.each([
    ['7:00 AM', '2026-11-19T12:00:00Z'],
    ['7:00 AM in summer time', '2026-07-01T11:00:00Z'],
    ['noon', '2026-11-19T17:00:00Z'],
    ['11:59 PM', '2026-11-20T04:59:59Z'],
  ])('sends nothing and claims nothing at %s ET', async (_label, iso) => {
    await sendOfflineNotice(ticket, at(iso))

    expect(mockFindOfflineNoticePausedUntil).not.toHaveBeenCalled()
    expect(mockClaimOfflineNotice).not.toHaveBeenCalled()
    expect(mockSendTelnyxSms).not.toHaveBeenCalled()
  })

  it('sends nothing when the phone already got the notice this night', async () => {
    mockClaimOfflineNotice.mockResolvedValue(false)

    await sendOfflineNotice(ticket, at('2026-11-19T08:30:00Z'))

    expect(mockSendTelnyxSms).not.toHaveBeenCalled()
  })

  it('sends nothing and claims nothing while an admin has it turned off', async () => {
    mockFindOfflineNoticePausedUntil.mockResolvedValue(new Date('2026-11-19T12:00:00Z'))

    await sendOfflineNotice(ticket, at('2026-11-19T11:59:59Z'))

    expect(mockFindOfflineNoticePausedUntil).toHaveBeenCalledWith(at('2026-11-19T11:59:59Z'))
    expect(mockClaimOfflineNotice).not.toHaveBeenCalled()
    expect(mockSendTelnyxSms).not.toHaveBeenCalled()
  })

  it('logs a failure and lets the bot carry on', async () => {
    mockClaimOfflineNotice.mockRejectedValue(new Error('database down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendOfflineNotice(ticket, at('2026-11-19T08:30:00Z'))).resolves.toBeUndefined()

    expect(mockSendTelnyxSms).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('SMS support offline notice failed:', {
      ticketId: 'ticket_123',
      error: new Error('database down'),
    })
    error.mockRestore()
  })

  it('never texts an opted-out phone', async () => {
    mockFindSmsPhoneOptOut.mockResolvedValue({ optedOutAt: new Date('2026-11-01T00:00:00Z') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await sendOfflineNotice(ticket, at('2026-11-19T08:30:00Z'))

    expect(mockFindSmsPhoneOptOut).toHaveBeenCalledWith('+15551234567')
    expect(mockSendTelnyxSms).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('SMS support offline notice was not sent:', {
      ticketId: 'ticket_123',
      error: 'Phone number is opted out',
    })
    warn.mockRestore()
  })
})

describe('offlineNoticePauseEnd', () => {
  it('turns the notice back on at the end of the current night', () => {
    expect(offlineNoticePauseEnd(at('2026-11-19T10:00:00Z')).toISOString()).toBe(
      '2026-11-19T12:00:00.000Z'
    )
  })

  it('covers the coming night when turned off during the day', () => {
    expect(offlineNoticePauseEnd(at('2026-11-19T12:00:00Z')).toISOString()).toBe(
      '2026-11-20T12:00:00.000Z'
    )
    expect(offlineNoticePauseEnd(at('2026-11-20T03:00:00Z')).toISOString()).toBe(
      '2026-11-20T12:00:00.000Z'
    )
  })
})
