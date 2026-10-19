import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
} from '../sms-support-types'

const {
  mockFindActiveSupportTicketForPhone,
  mockCreateInboundSupportTicket,
  mockRecordSupportTicketInbound,
  mockTransition,
  mockCancelSupportJobs,
  mockLinkSmsMessageToSupportTicket,
  mockFindSmsSupportSubmissionCandidatesForPhone,
  mockFindApprovedSubmissionIdForSupportTicket,
  mockFindLatestApprovedSubmissionIdsForSupportPhone,
  mockFindApprovedSupportSubmissionIdsByReference,
  mockFindApprovedSubmissionBirthDateForSupport,
  mockSendSupportSms,
  mockAlertSupportTicketNeedsCsr,
  mockEnqueueSupportAutomationJob,
  mockProcessSmsSupportJobNow,
} = vi.hoisted(() => ({
  mockFindActiveSupportTicketForPhone: vi.fn(),
  mockCreateInboundSupportTicket: vi.fn(),
  mockRecordSupportTicketInbound: vi.fn(),
  mockTransition: vi.fn(),
  mockCancelSupportJobs: vi.fn(),
  mockLinkSmsMessageToSupportTicket: vi.fn(),
  mockFindSmsSupportSubmissionCandidatesForPhone: vi.fn(),
  mockFindApprovedSubmissionIdForSupportTicket: vi.fn(),
  mockFindLatestApprovedSubmissionIdsForSupportPhone: vi.fn(),
  mockFindApprovedSupportSubmissionIdsByReference: vi.fn(),
  mockFindApprovedSubmissionBirthDateForSupport: vi.fn(),
  mockSendSupportSms: vi.fn(),
  mockAlertSupportTicketNeedsCsr: vi.fn(),
  mockEnqueueSupportAutomationJob: vi.fn(),
  mockProcessSmsSupportJobNow: vi.fn(),
}))

vi.mock('@/db/sms-support', () => ({
  findActiveSupportTicketForPhone: mockFindActiveSupportTicketForPhone,
  recordSupportTicketInbound: mockRecordSupportTicketInbound,
  linkSmsMessageToSupportTicket: mockLinkSmsMessageToSupportTicket,
}))

vi.mock('@/db/sms-support-lifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/sms-support-lifecycle')>()
  return {
    required: actual.required,
    transition: mockTransition,
    cancelSupportJobs: mockCancelSupportJobs,
    createInboundSupportTicket: mockCreateInboundSupportTicket,
  }
})

vi.mock('@/db/submissions', () => ({
  findSmsSupportSubmissionCandidatesForPhone: mockFindSmsSupportSubmissionCandidatesForPhone,
  findApprovedSubmissionIdForSupportTicket: mockFindApprovedSubmissionIdForSupportTicket,
  findLatestApprovedSubmissionIdsForSupportPhone:
    mockFindLatestApprovedSubmissionIdsForSupportPhone,
  findApprovedSupportSubmissionIdsByReference: mockFindApprovedSupportSubmissionIdsByReference,
  findApprovedSubmissionBirthDateForSupport: mockFindApprovedSubmissionBirthDateForSupport,
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

function moved(ticket: ReturnType<typeof supportTicket>) {
  return { ok: true, value: ticket }
}

describe('handleInboundSupportSms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendSupportSms.mockResolvedValue({ success: true })
    mockEnqueueSupportAutomationJob.mockResolvedValue({ id: 'job_123' })
    mockProcessSmsSupportJobNow.mockResolvedValue({ processed: 1, succeeded: 1, failed: 0 })
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([])
    mockFindLatestApprovedSubmissionIdsForSupportPhone.mockResolvedValue([])
    mockFindApprovedSupportSubmissionIdsByReference.mockResolvedValue([])
    mockTransition.mockResolvedValue(moved(supportTicket()))
    mockCancelSupportJobs.mockResolvedValue(0)
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(csrTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'My SSN is 123-45-6789 and diagnosis is flu',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'escalate',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        adminSummary: 'Customer message: My SSN is 123-45-6789 and diagnosis is flu',
        collectedData: expect.objectContaining({
          freeformMessage: 'My SSN is 123-45-6789 and diagnosis is flu',
        }),
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(null)
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([
      { id: 'sub_123', status: 'PENDING_REVIEW', smsMessages: [] },
    ])
    mockCreateInboundSupportTicket.mockResolvedValue(createdTicket)
    mockTransition.mockResolvedValue(moved(waitingTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockCreateInboundSupportTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneE164: '+15551234567',
        submissionId: 'sub_123',
      })
    )
    expect(mockFindSmsSupportSubmissionCandidatesForPhone).toHaveBeenCalledWith('+15551234567')
  })

  it('links a new inbound ticket when one approved submission shares the phone with an old denial', async () => {
    const createdTicket = supportTicket({ state: SMS_SUPPORT_STATE.INTRO_MENU })
    const waitingTicket = supportTicket({ state: SMS_SUPPORT_STATE.INTRO_MENU })

    mockFindActiveSupportTicketForPhone.mockResolvedValue(null)
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([
      { id: 'sub_approved', status: 'APPROVED', smsMessages: [] },
      { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
    ])
    mockCreateInboundSupportTicket.mockResolvedValue(createdTicket)
    mockTransition.mockResolvedValue(moved(waitingTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockCreateInboundSupportTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneE164: '+15551234567',
        submissionId: 'sub_approved',
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([
      { id: 'sub_approved', status: 'APPROVED', smsMessages: [] },
      { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
    ])
    mockRecordSupportTicketInbound.mockResolvedValueOnce(linkedTicket)
    mockTransition.mockResolvedValueOnce(moved(linkedTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_later',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockRecordSupportTicketInbound).toHaveBeenNthCalledWith(1, 'ticket_123', {
      matchedSubmissionId: 'sub_approved',
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })
    expect(mockLinkSmsMessageToSupportTicket).toHaveBeenCalledWith('msg_later', {
      supportTicketId: 'ticket_123',
      submissionId: 'sub_approved',
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(runningTicket)
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([
      { id: 'sub_approved', status: 'APPROVED', smsMessages: [] },
    ])
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockFindSmsSupportSubmissionCandidatesForPhone).not.toHaveBeenCalled()
    expect(mockRecordSupportTicketInbound).toHaveBeenCalledWith('ticket_123', {
      matchedSubmissionId: undefined,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(null)
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([
      {
        id: 'sub_pending',
        status: 'PENDING_REVIEW',
        smsMessages: [{ id: 'sms_purchase_confirmation', sentAt: new Date() }],
      },
      { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
    ])
    mockCreateInboundSupportTicket.mockResolvedValue(createdTicket)
    mockTransition.mockResolvedValue(moved(waitingTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_current_inbound',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockCreateInboundSupportTicket).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: 'sub_pending' })
    )
    expect(mockLinkSmsMessageToSupportTicket).toHaveBeenCalledWith('msg_current_inbound', {
      supportTicketId: 'ticket_123',
      submissionId: 'sub_pending',
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(null)
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([
      { id: 'sub_pending', status: 'PENDING_REVIEW', smsMessages: [] },
      { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
    ])
    mockCreateInboundSupportTicket.mockResolvedValue(createdTicket)
    mockTransition.mockResolvedValue(moved(waitingTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_current_inbound',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockCreateInboundSupportTicket).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: undefined })
    )
    expect(mockLinkSmsMessageToSupportTicket).toHaveBeenCalledWith('msg_current_inbound', {
      supportTicketId: 'ticket_123',
      submissionId: null,
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(null)
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([
      {
        id: 'sub_latest',
        status: 'APPROVED',
        smsMessages: [{ id: 'sms_approval' }],
      },
      { id: 'sub_other', status: 'APPROVED', smsMessages: [] },
    ])
    mockCreateInboundSupportTicket.mockResolvedValue(createdTicket)
    mockTransition.mockResolvedValue(moved(waitingTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      providerMessageId: 'msg_help',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockCreateInboundSupportTicket).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: undefined })
    )
    expect(mockLinkSmsMessageToSupportTicket).toHaveBeenCalledWith('msg_help', {
      supportTicketId: 'ticket_123',
      submissionId: null,
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(spamCheckTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '1',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'prompt',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_SPAM_CHECK,
        category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(closedTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '1',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith('closeFound', 'ticket_123', {
      at: expect.any(Date),
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(collectEmailTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '2',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'prompt',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_COLLECT_EMAIL,
        category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(csrTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'return date',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'escalate',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        category: SMS_SUPPORT_CATEGORY.RETURN_DATE,
        adminSummary: 'Customer asked a return-date question by SMS.',
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(csrTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'return to work date',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'escalate',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        category: SMS_SUPPORT_CATEGORY.RETURN_DATE,
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(changeMenuTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '2 change note',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'prompt',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
        category: null,
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(otherMenuTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '3',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'prompt',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        state: SMS_SUPPORT_STATE.OTHER_MENU,
        category: SMS_SUPPORT_CATEGORY.OTHER,
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(csrTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '2',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockEnqueueSupportAutomationJob).not.toHaveBeenCalled()
    expect(mockProcessSmsSupportJobNow).not.toHaveBeenCalled()
    expect(mockTransition).toHaveBeenLastCalledWith(
      'escalate',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
        adminSummary: 'Customer asked to change first/last day off by SMS.',
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(csrTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: '01/02/2020',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'escalate',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'HELP',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockRecordSupportTicketInbound).toHaveBeenCalledTimes(1)
    expect(mockTransition).not.toHaveBeenCalled()
    expect(mockRecordSupportTicketInbound).toHaveBeenCalledWith('ticket_123', {
      matchedSubmissionId: undefined,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(
      moved(
        supportTicket({
          submissionId: 'abc12345-submission',
          state: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
          category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
        })
      )
    )
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValueOnce([
      { id: 'abc12345-submission', status: 'APPROVED', smsMessages: [] },
      { id: 'def67890-submission', status: 'APPROVED', smsMessages: [] },
    ])
    mockFindApprovedSupportSubmissionIdsByReference.mockResolvedValueOnce([
      { id: 'abc12345-submission' },
    ])

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'Ref #ABC12345',
      providerMessageId: 'msg_ref',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockFindApprovedSupportSubmissionIdsByReference).toHaveBeenCalledWith('+15551234567', {
      idPrefix: 'abc12345',
      medicalRecordNumber: 'ABC12345',
    })
    expect(mockTransition).toHaveBeenLastCalledWith(
      'prompt',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        submissionId: 'abc12345-submission',
        state: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
        category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
      })
    )
    expect(mockLinkSmsMessageToSupportTicket).toHaveBeenLastCalledWith('msg_ref', {
      supportTicketId: 'ticket_123',
      submissionId: 'abc12345-submission',
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockFindSmsSupportSubmissionCandidatesForPhone.mockResolvedValue([
      { id: 'abc12345-submission', status: 'APPROVED', smsMessages: [] },
      { id: 'def67890-submission', status: 'APPROVED', smsMessages: [] },
    ])
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'Ref #A',
      providerMessageId: 'msg_ref_short',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockFindSmsSupportSubmissionCandidatesForPhone).toHaveBeenCalledTimes(1)
    expect(mockFindLatestApprovedSubmissionIdsForSupportPhone).not.toHaveBeenCalled()
    expect(mockFindApprovedSupportSubmissionIdsByReference).not.toHaveBeenCalled()
    expect(mockRecordSupportTicketInbound).toHaveBeenCalledTimes(1)
    expect(mockTransition).not.toHaveBeenCalled()
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)

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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(csrTicket))

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'legal',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith(
      'escalate',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
        adminSummary: 'Customer asked to change note purpose to a legal matter by SMS.',
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(queuedTicket))

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
    expect(mockTransition).toHaveBeenLastCalledWith(
      'queueAutomation',
      'ticket_123',
      expect.objectContaining({
        at: expect.any(Date),
        category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
        collectedData: {
          notePurpose: 'both',
          otherNotePurpose: null,
        },
      })
    )
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

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockFindApprovedSubmissionIdForSupportTicket.mockResolvedValue({ id: 'sub_123' })
    mockRecordSupportTicketInbound.mockResolvedValueOnce(touchedTicket)
    mockTransition.mockResolvedValueOnce(moved(collectTicket))
    mockTransition.mockResolvedValueOnce(moved(failedTicket))
    mockSendSupportSms.mockResolvedValue({ success: false, error: 'Telnyx timeout' })

    await handleInboundSupportSms({
      fromPhone: '+15551234567',
      body: 'change birthday',
      receivedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTransition).toHaveBeenLastCalledWith('replyFailed', 'ticket_123', {
      at: expect.any(Date),
      failureReason: 'Support SMS send failed: Telnyx timeout',
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        summary: 'Support SMS failed to send. Customer may not have received the latest prompt.',
      })
    )
    expect(mockCancelSupportJobs).toHaveBeenCalledWith('ticket_123', {
      lastError: 'Support SMS failed before automation completed',
      at: expect.any(Date),
    })
  })

  it('fails loudly without replying when the ticket left the conversation before the prompt was saved', async () => {
    const activeTicket = supportTicket({
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      category: null,
    })

    mockFindActiveSupportTicketForPhone.mockResolvedValue(activeTicket)
    mockRecordSupportTicketInbound.mockResolvedValueOnce(activeTicket)
    mockTransition.mockResolvedValue({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.CLOSED },
    })

    await expect(
      handleInboundSupportSms({
        fromPhone: '+15551234567',
        body: '2 change note',
        receivedAt: new Date('2026-06-29T12:05:00Z'),
      })
    ).rejects.toThrow('prompt of support ticket ticket_123 was refused: the status is CLOSED')

    expect(mockTransition).toHaveBeenCalledTimes(1)
    expect(mockSendSupportSms).not.toHaveBeenCalled()
    expect(mockCancelSupportJobs).not.toHaveBeenCalled()
  })
})
