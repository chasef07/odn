import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
} from '../sms-support-types'

const {
  mockSmsSupportTicketFindFirst,
  mockSmsSupportTicketCreate,
  mockSmsSupportTicketUpdate,
  mockSmsSupportJobUpdateMany,
  mockSmsMessageUpdateMany,
  mockSubmissionFindFirst,
  mockSubmissionFindMany,
  mockSendSupportSms,
  mockAlertSupportTicketNeedsCsr,
  mockEnqueueSupportAutomationJob,
  mockProcessSmsSupportJobNow,
} = vi.hoisted(() => ({
  mockSmsSupportTicketFindFirst: vi.fn(),
  mockSmsSupportTicketCreate: vi.fn(),
  mockSmsSupportTicketUpdate: vi.fn(),
  mockSmsSupportJobUpdateMany: vi.fn(),
  mockSmsMessageUpdateMany: vi.fn(),
  mockSubmissionFindFirst: vi.fn(),
  mockSubmissionFindMany: vi.fn(),
  mockSendSupportSms: vi.fn(),
  mockAlertSupportTicketNeedsCsr: vi.fn(),
  mockEnqueueSupportAutomationJob: vi.fn(),
  mockProcessSmsSupportJobNow: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    smsSupportTicket: {
      findFirst: mockSmsSupportTicketFindFirst,
      create: mockSmsSupportTicketCreate,
      update: mockSmsSupportTicketUpdate,
    },
    smsSupportJob: {
      updateMany: mockSmsSupportJobUpdateMany,
    },
    smsMessage: {
      updateMany: mockSmsMessageUpdateMany,
    },
    submission: {
      findFirst: mockSubmissionFindFirst,
      findMany: mockSubmissionFindMany,
    },
  },
}))

vi.mock('@/lib/sms-support-sms', () => ({
  sendSupportSms: mockSendSupportSms,
}))

vi.mock('@/lib/sms-support-alerts', () => ({
  alertSupportTicketNeedsCsr: mockAlertSupportTicketNeedsCsr,
}))

vi.mock('@/lib/sms-support-jobs', () => ({
  enqueueSupportAutomationJob: mockEnqueueSupportAutomationJob,
  processSmsSupportJobNow: mockProcessSmsSupportJobNow,
  SupportAutomationPayloadConflictError: class SupportAutomationPayloadConflictError extends Error {},
}))

import { handleInboundSupportSms } from '../sms-support'

function supportTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket_123',
    phoneE164: '+15551234567',
    submissionId: 'sub_123',
    status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
    category: SMS_SUPPORT_CATEGORY.OTHER,
    state: SMS_SUPPORT_STATE.OTHER_COLLECT_MESSAGE,
    source: SMS_SUPPORT_SOURCE.INBOUND_SMS,
    automationKind: null,
    automationStatus: null,
    collectedData: null,
    adminSummary: null,
    failureReason: null,
    retryCount: 0,
    csrAlertedAt: null,
    lastInboundAt: null,
    lastOutboundAt: null,
    closedAt: null,
    createdAt: new Date('2026-06-29T12:00:00Z'),
    updatedAt: new Date('2026-06-29T12:00:00Z'),
    ...overrides,
  }
}

describe('handleInboundSupportSms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendSupportSms.mockResolvedValue({ success: true })
    mockEnqueueSupportAutomationJob.mockResolvedValue({ id: 'job_123' })
    mockProcessSmsSupportJobNow.mockResolvedValue({ processed: 1, succeeded: 1, failed: 0 })
    mockSubmissionFindMany.mockResolvedValue([])
  })

  it('keeps raw freeform SMS in the ticket but sends a sanitized admin alert summary', async () => {
    const activeTicket = supportTicket()
    const touchedTicket = supportTicket({ lastInboundAt: new Date('2026-06-29T12:05:00Z') })
    const csrTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      adminSummary: 'Customer message: My SSN is 123-45-6789 and diagnosis is flu',
      collectedData: { freeformMessage: 'My SSN is 123-45-6789 and diagnosis is flu' },
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket).mockResolvedValueOnce(csrTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'My SSN is 123-45-6789 and diagnosis is flu',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        adminSummary: 'Customer message: My SSN is 123-45-6789 and diagnosis is flu',
        collectedData: expect.objectContaining({
          freeformMessage: 'My SSN is 123-45-6789 and diagnosis is flu',
        }),
      }),
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Customer sent a freeform support message. Details are in the ticket.',
      })
    )
    expect(mockAlertSupportTicketNeedsCsr.mock.calls[0][0].summary).not.toContain('123-45-6789')
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        type: 'SUPPORT_CSR_ALERT',
      })
    )
  })

  it('links a new inbound ticket when exactly one submission matches the phone', async () => {
    const createdTicket = supportTicket({ state: SMS_SUPPORT_STATE.INTRO_MENU })
    const waitingTicket = supportTicket({ state: SMS_SUPPORT_STATE.INTRO_MENU })

    mockSmsSupportTicketFindFirst.mockResolvedValue(null)
    mockSubmissionFindMany.mockResolvedValue([
      { id: 'sub_123', status: 'PENDING_REVIEW', smsMessages: [] },
    ])
    mockSmsSupportTicketCreate.mockResolvedValue(createdTicket)
    mockSmsSupportTicketUpdate.mockResolvedValue(waitingTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phoneE164: '+15551234567',
        submissionId: 'sub_123',
      }),
    })
    expect(mockSubmissionFindMany).toHaveBeenCalledWith({
      where: {
        smsPhoneE164: '+15551234567',
        smsOptIn: true,
      },
      select: {
        id: true,
        status: true,
        smsMessages: {
          where: {
            direction: 'outbound',
            to: '+15551234567',
            sentAt: { not: null },
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('links a new inbound ticket when one approved submission shares the phone with an old denial', async () => {
    const createdTicket = supportTicket({ state: SMS_SUPPORT_STATE.INTRO_MENU })
    const waitingTicket = supportTicket({ state: SMS_SUPPORT_STATE.INTRO_MENU })

    mockSmsSupportTicketFindFirst.mockResolvedValue(null)
    mockSubmissionFindMany.mockResolvedValue([
      { id: 'sub_approved', status: 'APPROVED', smsMessages: [] },
      { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
    ])
    mockSmsSupportTicketCreate.mockResolvedValue(createdTicket)
    mockSmsSupportTicketUpdate.mockResolvedValue(waitingTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phoneE164: '+15551234567',
        submissionId: 'sub_approved',
      }),
    })
  })

  it('re-evaluates an active unassigned ticket when a later message has one approved match', async () => {
    const activeTicket = supportTicket({
      submissionId: null,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const linkedTicket = supportTicket({
      submissionId: 'sub_approved',
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSubmissionFindMany.mockResolvedValue([
      { id: 'sub_approved', status: 'APPROVED', smsMessages: [] },
      { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
    ])
    mockSmsSupportTicketUpdate
      .mockResolvedValueOnce(linkedTicket)
      .mockResolvedValueOnce(linkedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_later',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'ticket_123' },
      data: {
        submissionId: 'sub_approved',
        lastInboundAt: new Date('2026-06-29T12:05:00Z'),
        closedAt: null,
      },
    })
    expect(mockSmsMessageUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_later' },
      data: {
        supportTicketId: 'ticket_123',
        submissionId: 'sub_approved',
      },
    })
  })

  it('does not relink an unassigned ticket while automation is running', async () => {
    const runningTicket = supportTicket({
      submissionId: null,
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
    })
    const touchedTicket = supportTicket({
      ...runningTicket,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(runningTicket)
    mockSubmissionFindMany.mockResolvedValue([
      { id: 'sub_approved', status: 'APPROVED', smsMessages: [] },
    ])
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSubmissionFindMany).not.toHaveBeenCalled()
    expect(mockSmsSupportTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: {
        lastInboundAt: new Date('2026-06-29T12:05:00Z'),
        closedAt: null,
      },
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SUPPORT_AUTOMATION_UPDATE' })
    )
  })

  it('links a ticket when one matching submission owns the prior outbound SMS conversation', async () => {
    const createdTicket = supportTicket({
      submissionId: 'sub_pending',
      state: SMS_SUPPORT_STATE.INTRO_MENU,
    })
    const waitingTicket = supportTicket({
      submissionId: 'sub_pending',
      state: SMS_SUPPORT_STATE.INTRO_MENU,
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(null)
    mockSubmissionFindMany.mockResolvedValue([
      {
        id: 'sub_pending',
        status: 'PENDING_REVIEW',
        smsMessages: [{ id: 'sms_purchase_confirmation', sentAt: new Date() }],
      },
      { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
    ])
    mockSmsSupportTicketCreate.mockResolvedValue(createdTicket)
    mockSmsSupportTicketUpdate.mockResolvedValue(waitingTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_current_inbound',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ submissionId: 'sub_pending' }),
    })
    expect(mockSmsMessageUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_current_inbound' },
      data: {
        supportTicketId: 'ticket_123',
        submissionId: 'sub_pending',
      },
    })
  })

  it('does not treat a failed outbound SMS as conversation evidence', async () => {
    const createdTicket = supportTicket({
      submissionId: null,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
    })
    const waitingTicket = supportTicket({
      submissionId: null,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(null)
    mockSubmissionFindMany.mockImplementation(
      async (query: { select?: { smsMessages?: { where?: { sentAt?: { not?: null } } } } }) => {
        const excludesUnsentMessages = query.select?.smsMessages?.where?.sentAt?.not === null
        return [
          {
            id: 'sub_pending',
            status: 'PENDING_REVIEW',
            smsMessages: excludesUnsentMessages ? [] : [{ id: 'sms_sending_failed' }],
          },
          { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
        ]
      }
    )
    mockSmsSupportTicketCreate.mockResolvedValue(createdTicket)
    mockSmsSupportTicketUpdate.mockResolvedValue(waitingTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_current_inbound',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ submissionId: undefined }),
    })
    expect(mockSmsMessageUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_current_inbound' },
      data: {
        supportTicketId: 'ticket_123',
        submissionId: null,
      },
    })
  })

  it('clears provisional submission links when multiple approved submissions remain ambiguous', async () => {
    const createdTicket = supportTicket({
      submissionId: null,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
    })
    const waitingTicket = supportTicket({
      submissionId: null,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(null)
    mockSubmissionFindMany.mockResolvedValue([
      {
        id: 'sub_latest',
        status: 'APPROVED',
        smsMessages: [{ id: 'sms_approval' }],
      },
      { id: 'sub_other', status: 'APPROVED', smsMessages: [] },
    ])
    mockSmsSupportTicketCreate.mockResolvedValue(createdTicket)
    mockSmsSupportTicketUpdate.mockResolvedValue(waitingTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_help',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ submissionId: undefined }),
    })
    expect(mockSmsMessageUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_help' },
      data: {
        supportTicketId: 'ticket_123',
        submissionId: null,
      },
    })
  })

  it('starts the missing-note spam check before asking for email', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const spamCheckTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_SPAM_CHECK,
      category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate
      .mockResolvedValueOnce(touchedTicket)
      .mockResolvedValueOnce(spamCheckTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '1',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_SPAM_CHECK,
        category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
      }),
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        body: expect.stringContaining('Reply 1 if you found it'),
      })
    )
  })

  it('closes a missing-note ticket when the customer finds the note in spam', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_SPAM_CHECK,
      category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
    })
    const touchedTicket = supportTicket({
      ...activeTicket,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })
    const closedTicket = supportTicket({
      ...activeTicket,
      status: SMS_SUPPORT_STATUS.CLOSED,
      state: SMS_SUPPORT_STATE.CLOSED,
      adminSummary: 'Customer found the note after checking spam/junk.',
      closedAt: new Date('2026-06-29T12:05:00Z'),
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate
      .mockResolvedValueOnce(touchedTicket)
      .mockResolvedValueOnce(closedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '1',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.CLOSED,
        state: SMS_SUPPORT_STATE.CLOSED,
        category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
        adminSummary: 'Customer found the note after checking spam/junk.',
        closedAt: expect.any(Date),
      }),
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        body: expect.stringContaining('No further action'),
      })
    )
  })

  it('asks for corrected email when the missing note is still not found', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_SPAM_CHECK,
      category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
    })
    const touchedTicket = supportTicket({
      ...activeTicket,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })
    const collectEmailTicket = supportTicket({
      ...activeTicket,
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_COLLECT_EMAIL,
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate
      .mockResolvedValueOnce(touchedTicket)
      .mockResolvedValueOnce(collectEmailTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '2',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_COLLECT_EMAIL,
        category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
      }),
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        body: expect.stringContaining('correct email address'),
      })
    )
  })

  it('routes return-date menu replies to admin', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
      category: null,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
      category: null,
    })
    const csrTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.RETURN_DATE,
      adminSummary: 'Customer asked a return-date question by SMS.',
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket).mockResolvedValueOnce(csrTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'return date',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        category: SMS_SUPPORT_CATEGORY.RETURN_DATE,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        adminSummary: 'Customer asked a return-date question by SMS.',
      }),
    })
  })

  it('routes return-to-work-date messages to admin from the intro menu', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const csrTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.RETURN_DATE,
      adminSummary: 'Customer asked a return-date question by SMS.',
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket).mockResolvedValueOnce(csrTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'return to work date',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        category: SMS_SUPPORT_CATEGORY.RETURN_DATE,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
      }),
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Customer asked a return-date question by SMS.',
      })
    )
  })

  it('accepts copied change-note menu labels from the intro menu', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const changeMenuTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
      category: null,
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate
      .mockResolvedValueOnce(touchedTicket)
      .mockResolvedValueOnce(changeMenuTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '2 change note',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
        category: null,
      }),
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        body: expect.stringContaining('3 Date of birth'),
      })
    )
  })

  it('keeps refund and form requests behind the shortened other menu', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const otherMenuTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: SMS_SUPPORT_STATE.OTHER_MENU,
      category: SMS_SUPPORT_CATEGORY.OTHER,
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate
      .mockResolvedValueOnce(touchedTicket)
      .mockResolvedValueOnce(otherMenuTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '3',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.OTHER_MENU,
        category: SMS_SUPPORT_CATEGORY.OTHER,
      }),
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        body: expect.stringContaining('1 Need an additional form'),
      })
    )
  })

  it('routes first/last date changes to admin instead of automation', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
      category: null,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
      category: null,
    })
    const csrTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
      adminSummary: 'Customer asked to change first/last day off by SMS.',
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket).mockResolvedValueOnce(csrTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '2',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockEnqueueSupportAutomationJob).not.toHaveBeenCalled()
    expect(mockProcessSmsSupportJobNow).not.toHaveBeenCalled()
    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
        adminSummary: 'Customer asked to change first/last day off by SMS.',
      }),
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        type: 'SUPPORT_CSR_ALERT',
        body: expect.stringContaining('Email hello@onlinedoctornote.com'),
      })
    )
  })

  it('escalates stale date collection tickets to admin instead of continuing automation', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_LAST,
      category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
      collectedData: { firstDayOff: '2020-01-01' },
    })
    const touchedTicket = supportTicket({
      ...activeTicket,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })
    const csrTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
      adminSummary: 'Customer asked to change first/last day off by SMS.',
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket).mockResolvedValueOnce(csrTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '01/02/2020',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
      }),
    })
    expect(mockEnqueueSupportAutomationJob).not.toHaveBeenCalled()
  })

  it('keeps already escalated admin tickets in the admin queue when customers ask for help', async () => {
    const activeTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.REFUND,
      adminSummary: 'Refund request needs admin review.',
    })
    const touchedTicket = supportTicket({
      ...activeTicket,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenCalledTimes(1)
    expect(mockSmsSupportTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: {
        lastInboundAt: new Date('2026-06-29T12:05:00Z'),
        closedAt: null,
      },
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        type: 'SUPPORT_CSR_ALERT',
      })
    )
  })

  it('accepts copied Ref # prefixes when resolving ambiguous approved notes', async () => {
    const activeTicket = supportTicket({
      submissionId: null,
      state: SMS_SUPPORT_STATE.COLLECT_SUBMISSION_REF,
      category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
      collectedData: {
        pendingCategory: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
        pendingState: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
      },
    })
    const touchedTicket = supportTicket({
      ...activeTicket,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket).mockResolvedValueOnce(
      supportTicket({
        submissionId: 'abc12345-submission',
        state: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
        category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
      })
    )
    mockSubmissionFindMany
      .mockResolvedValueOnce([
        { id: 'abc12345-submission', status: 'APPROVED', smsMessages: [] },
        { id: 'def67890-submission', status: 'APPROVED', smsMessages: [] },
      ])
      .mockResolvedValueOnce([{ id: 'abc12345-submission' }])

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'Ref #ABC12345',
      providerMessageId: 'msg_ref',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSubmissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          smsPhoneE164: '+15551234567',
          status: 'APPROVED',
          OR: expect.arrayContaining([
            { id: { startsWith: 'abc12345' } },
            { noteVerifications: { some: { medicalRecordNumber: 'ABC12345' } } },
          ]),
        }),
      })
    )
    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        submissionId: 'abc12345-submission',
        state: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
        category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
      }),
    })
    expect(mockSmsMessageUpdateMany).toHaveBeenLastCalledWith({
      where: { providerMessageId: 'msg_ref' },
      data: {
        supportTicketId: 'ticket_123',
        submissionId: 'abc12345-submission',
      },
    })
  })

  it('does not resolve ambiguous approved notes from a partial Ref # reply', async () => {
    const activeTicket = supportTicket({
      submissionId: null,
      state: SMS_SUPPORT_STATE.COLLECT_SUBMISSION_REF,
      category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
      collectedData: {
        pendingCategory: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
        pendingState: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
      },
    })
    const touchedTicket = supportTicket({
      ...activeTicket,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSubmissionFindMany.mockResolvedValue([
      { id: 'abc12345-submission', status: 'APPROVED', smsMessages: [] },
      { id: 'def67890-submission', status: 'APPROVED', smsMessages: [] },
    ])
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'Ref #A',
      providerMessageId: 'msg_ref_short',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSubmissionFindMany).toHaveBeenCalledTimes(1)
    expect(mockSmsSupportTicketUpdate).toHaveBeenCalledTimes(1)
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        body: expect.stringContaining('Ref #'),
      })
    )
  })

  it('rejects ambiguous short birthday dates instead of queueing automation', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
      category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
    })
    const touchedTicket = supportTicket({
      ...activeTicket,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '3/4/1990',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockEnqueueSupportAutomationJob).not.toHaveBeenCalled()
    expect(mockProcessSmsSupportJobNow).not.toHaveBeenCalled()
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        body: expect.stringContaining('valid date in MM/DD/YYYY format'),
      })
    )
  })

  it('routes legal purpose replies to admin review instead of invalid-purpose retry', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
    })
    const csrTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
      adminSummary: 'Customer asked to change note purpose to a legal matter by SMS.',
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate.mockResolvedValueOnce(touchedTicket).mockResolvedValueOnce(csrTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'legal',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
        adminSummary: 'Customer asked to change note purpose to a legal matter by SMS.',
      }),
    })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        type: 'SUPPORT_CSR_ALERT',
      })
    )
  })

  it('parses reversed work/school purpose replies as both', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
    })
    const queuedTicket = supportTicket({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
      collectedData: { notePurpose: 'both', otherNotePurpose: null },
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSmsSupportTicketUpdate
      .mockResolvedValueOnce(touchedTicket)
      .mockResolvedValueOnce(queuedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'school and work',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockEnqueueSupportAutomationJob).toHaveBeenCalledWith({
      ticketId: 'ticket_123',
      payload: expect.objectContaining({
        updates: expect.objectContaining({
          notePurpose: 'both',
          otherNotePurpose: null,
        }),
      }),
    })
    expect(mockProcessSmsSupportJobNow).toHaveBeenCalledWith(
      'job_123',
      expect.objectContaining({
        workerId: expect.stringMatching(/^sms-inbound-/),
      })
    )
    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
        collectedData: {
          notePurpose: 'both',
          otherNotePurpose: null,
        },
      }),
    })
  })

  it('escalates to admin when a support SMS prompt fails to send', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })
    const touchedTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })
    const collectTicket = supportTicket({
      submissionId: 'sub_123',
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
      category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
    })
    const failedTicket = supportTicket({
      ...collectTicket,
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      failureReason: 'Support SMS send failed: Telnyx timeout',
    })

    mockSmsSupportTicketFindFirst.mockResolvedValue(activeTicket)
    mockSubmissionFindFirst.mockResolvedValue({ id: 'sub_123' })
    mockSmsSupportTicketUpdate
      .mockResolvedValueOnce(touchedTicket)
      .mockResolvedValueOnce(collectTicket)
      .mockResolvedValueOnce(failedTicket)
    mockSendSupportSms.mockResolvedValue({ success: false, error: 'Telnyx timeout' })

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'change birthday',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockSmsSupportTicketUpdate).toHaveBeenLastCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        failureReason: 'Support SMS send failed: Telnyx timeout',
        adminSummary: 'Support SMS failed to send. Admin should contact the customer manually.',
      }),
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        summary: 'Support SMS failed to send. Customer may not have received the latest prompt.',
      })
    )
    expect(mockSmsSupportJobUpdateMany).toHaveBeenCalledWith({
      where: {
        ticketId: 'ticket_123',
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'Support SMS failed before automation completed',
      }),
    })
  })
})
