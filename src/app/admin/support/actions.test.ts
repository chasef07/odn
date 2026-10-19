import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetSession,
  mockFindSubmissionForSupportTicket,
  mockFindSmsPhoneOptOut,
  mockFindActiveSupportTicketSummaryForPhone,
  mockAssignSupportTicketSubmission,
  mockCreateAdminSupportTicket,
  mockTransition,
  mockCancelSupportJobs,
  mockFindCommittingSupportJob,
  mockSendSupportSms,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindSubmissionForSupportTicket: vi.fn(),
  mockFindSmsPhoneOptOut: vi.fn(),
  mockFindActiveSupportTicketSummaryForPhone: vi.fn(),
  mockAssignSupportTicketSubmission: vi.fn(),
  mockCreateAdminSupportTicket: vi.fn(),
  mockTransition: vi.fn(),
  mockCancelSupportJobs: vi.fn(),
  mockFindCommittingSupportJob: vi.fn(),
  mockSendSupportSms: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('@/db/submissions', () => ({
  findSubmissionForSupportTicket: mockFindSubmissionForSupportTicket,
}))

vi.mock('@/db/sms-support', () => ({
  findSmsPhoneOptOut: mockFindSmsPhoneOptOut,
  findActiveSupportTicketSummaryForPhone: mockFindActiveSupportTicketSummaryForPhone,
  assignSupportTicketSubmission: mockAssignSupportTicketSubmission,
  findActiveSupportTicketsForQueue: vi.fn(),
  findClosedSupportTicketsForQueue: vi.fn(),
  findSupportTicketDetail: vi.fn(),
  findSupportTicketsWithStatus: vi.fn(),
  findCommittingSupportJob: mockFindCommittingSupportJob,
}))

vi.mock('@/db/sms-support-lifecycle', () => ({
  createAdminSupportTicket: mockCreateAdminSupportTicket,
  transition: mockTransition,
  cancelSupportJobs: mockCancelSupportJobs,
}))

vi.mock('@/lib/sms-support-sms', () => ({
  sendSupportSms: mockSendSupportSms,
}))

vi.mock('@/lib/sms-support-jobs', () => ({
  retrySupportAutomationJob: vi.fn(),
}))

import { createSupportTicketFromSubmission } from '@/app/admin/support/_actions/tickets'
import {
  closeSupportTicket,
  markSupportTicketNeedsCsr,
  sendSupportTicketReply,
} from '@/app/admin/support/_actions/ticket-updates'

const ticketRow = {
  id: 'ticket_123',
  phoneE164: '+15551234567',
  submissionId: 'sub_123',
}

describe('createSupportTicketFromSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: 'admin_123' },
    })
    mockFindSubmissionForSupportTicket.mockResolvedValue({
      id: 'sub_123',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
      patientFirstName: 'Jane',
      patientLastName: 'Doe',
    })
    mockFindSmsPhoneOptOut.mockResolvedValue(null)
    mockFindActiveSupportTicketSummaryForPhone.mockResolvedValue(null)
    mockCreateAdminSupportTicket.mockResolvedValue(ticketRow)
    mockAssignSupportTicketSubmission.mockResolvedValue(undefined)
    mockTransition.mockResolvedValue({ ok: true, value: ticketRow })
    mockFindCommittingSupportJob.mockResolvedValue(null)
    mockCancelSupportJobs.mockResolvedValue(0)
    mockSendSupportSms.mockResolvedValue({ success: true })
  })

  it('blocks admin-created SMS tickets when the phone has opted out', async () => {
    mockFindSmsPhoneOptOut.mockResolvedValue({
      optedOutAt: new Date('2026-06-29T12:00:00Z'),
    })

    const result = await createSupportTicketFromSubmission('sub_123')

    expect(result).toEqual({
      success: false,
      error: 'Phone number is opted out of SMS. Customer must text START before SMS support.',
    })
    expect(mockFindSmsPhoneOptOut).toHaveBeenCalledWith('+15551234567')
    expect(mockCreateAdminSupportTicket).not.toHaveBeenCalled()
  })

  it('reuses any active ticket for the same phone', async () => {
    mockFindActiveSupportTicketSummaryForPhone.mockResolvedValue({
      id: 'ticket_existing',
      submissionId: null,
    })

    const result = await createSupportTicketFromSubmission('sub_123')

    expect(result).toEqual({ success: true, ticketId: 'ticket_existing' })
    expect(mockFindActiveSupportTicketSummaryForPhone).toHaveBeenCalledWith('+15551234567')
    expect(mockAssignSupportTicketSubmission).toHaveBeenCalledWith('ticket_existing', 'sub_123')
    expect(mockCreateAdminSupportTicket).not.toHaveBeenCalled()
  })

  it('does not relink an active automation ticket to a different submission', async () => {
    mockFindActiveSupportTicketSummaryForPhone.mockResolvedValue({
      id: 'ticket_running',
      status: 'RUNNING_AUTOMATION',
      submissionId: 'sub_original',
    })

    const result = await createSupportTicketFromSubmission('sub_123')

    expect(result).toEqual({ success: true, ticketId: 'ticket_running' })
    expect(mockAssignSupportTicketSubmission).not.toHaveBeenCalled()
    expect(mockCreateAdminSupportTicket).not.toHaveBeenCalled()
  })

  it('cancels queued automation jobs when admin marks a ticket for review', async () => {
    const result = await markSupportTicketNeedsCsr('ticket_123')

    expect(result).toEqual({ success: true })
    expect(mockTransition).toHaveBeenCalledWith('returnToCsr', 'ticket_123', {
      at: expect.any(Date),
    })
    expect(mockCancelSupportJobs).toHaveBeenCalledWith('ticket_123', {
      lastError: 'Ticket escalated to admin before automation ran',
      at: expect.any(Date),
    })
    expect(mockCancelSupportJobs.mock.invocationCallOrder[0]).toBeLessThan(
      mockTransition.mock.invocationCallOrder[0]
    )
  })

  it('cancels queued automation jobs when admin closes a ticket', async () => {
    const result = await closeSupportTicket('ticket_123')

    expect(result).toEqual({ success: true })
    expect(mockTransition).toHaveBeenCalledWith('closeByAdmin', 'ticket_123', {
      at: expect.any(Date),
    })
    expect(mockCancelSupportJobs).toHaveBeenCalledWith('ticket_123', {
      lastError: 'Ticket closed by admin before automation ran',
      at: expect.any(Date),
    })
  })

  it('reports a missing ticket when admin marks it for review', async () => {
    mockTransition.mockResolvedValue({ ok: false, refusal: { reason: 'missing' } })

    const result = await markSupportTicketNeedsCsr('ticket_123')

    expect(result).toEqual({ success: false, error: 'Support ticket not found' })
  })

  it('asks admin to refresh when the ticket changed before it could be closed', async () => {
    mockTransition.mockResolvedValue({ ok: false, refusal: { reason: 'stale' } })

    const result = await closeSupportTicket('ticket_123')

    expect(result).toEqual({
      success: false,
      error: 'Support ticket was already updated. Please refresh and try again.',
    })
  })

  it('cancels queued automation jobs and clears prior alert state when admin replies by SMS', async () => {
    const result = await sendSupportTicketReply('ticket_123', 'We will handle this manually.')

    expect(result).toEqual({ success: true })
    expect(mockSendSupportSms).toHaveBeenCalledWith({
      ticketId: 'ticket_123',
      submissionId: 'sub_123',
      toPhone: '+15551234567',
      type: 'SUPPORT_REPLY',
      body: 'We will handle this manually.',
    })
    expect(mockTransition).toHaveBeenCalledTimes(1)
    expect(mockTransition).toHaveBeenCalledWith('adminReplied', 'ticket_123', {
      at: expect.any(Date),
    })
    expect(mockCancelSupportJobs).toHaveBeenCalledWith('ticket_123', {
      lastError: 'Ticket replied to by admin before automation completed',
      at: expect.any(Date),
    })
    expect(mockCancelSupportJobs.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendSupportSms.mock.invocationCallOrder[0]
    )
    expect(mockTransition.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendSupportSms.mock.invocationCallOrder[0]
    )
  })

  it('sends the reply to the contact on the ticket row the transition returned', async () => {
    mockTransition.mockResolvedValue({
      ok: true,
      value: { id: 'ticket_123', phoneE164: '+15559876543', submissionId: null },
    })

    const result = await sendSupportTicketReply('ticket_123', 'We will handle this manually.')

    expect(result).toEqual({ success: true })
    expect(mockSendSupportSms).toHaveBeenCalledWith(
      expect.objectContaining({ toPhone: '+15559876543', submissionId: null })
    )
  })

  it('records the failure when the admin reply SMS does not send', async () => {
    mockSendSupportSms.mockResolvedValue({ success: false, error: 'Carrier rejected' })

    const result = await sendSupportTicketReply('ticket_123', 'We will handle this manually.')

    expect(result).toEqual({ success: false, error: 'Carrier rejected' })
    expect(mockTransition).toHaveBeenLastCalledWith('adminReplyFailed', 'ticket_123', {
      at: expect.any(Date),
      failureReason: 'Admin SMS reply failed: Carrier rejected',
    })
  })

  it('does not send an admin reply for a missing ticket', async () => {
    mockTransition.mockResolvedValue({ ok: false, refusal: { reason: 'missing' } })

    const result = await sendSupportTicketReply('ticket_123', 'We will handle this manually.')

    expect(result).toEqual({ success: false, error: 'Support ticket not found' })
    expect(mockSendSupportSms).not.toHaveBeenCalled()
  })

  it('does not let admin reply while an automation job is finalizing the reissue', async () => {
    mockFindCommittingSupportJob.mockResolvedValue({ id: 'job_finalizing' })

    const result = await sendSupportTicketReply('ticket_123', 'We will handle this manually.')

    expect(result).toEqual({
      success: false,
      error: 'Automation is finalizing the updated note. Refresh in a moment before taking over.',
    })
    expect(mockSendSupportSms).not.toHaveBeenCalled()
    expect(mockTransition).not.toHaveBeenCalled()
  })
})
