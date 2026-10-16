import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetSession,
  mockFindSubmissionForSupportTicket,
  mockFindSmsPhoneOptOut,
  mockFindActiveSupportTicketSummaryForPhone,
  mockAssignSupportTicketSubmission,
  mockCreateAdminSupportTicket,
  mockFindSupportTicketContact,
  mockMarkSupportTicketAdminReplied,
  mockMarkSupportTicketAdminReplyFailed,
  mockReturnSupportTicketToCsrReview,
  mockFailQueuedOrRunningSupportJobs,
  mockFindCommittingSupportJob,
  mockSendSupportSms,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindSubmissionForSupportTicket: vi.fn(),
  mockFindSmsPhoneOptOut: vi.fn(),
  mockFindActiveSupportTicketSummaryForPhone: vi.fn(),
  mockAssignSupportTicketSubmission: vi.fn(),
  mockCreateAdminSupportTicket: vi.fn(),
  mockFindSupportTicketContact: vi.fn(),
  mockMarkSupportTicketAdminReplied: vi.fn(),
  mockMarkSupportTicketAdminReplyFailed: vi.fn(),
  mockReturnSupportTicketToCsrReview: vi.fn(),
  mockFailQueuedOrRunningSupportJobs: vi.fn(),
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
  createAdminSupportTicket: mockCreateAdminSupportTicket,
  findActiveSupportTicketsForQueue: vi.fn(),
  findClosedSupportTicketsForQueue: vi.fn(),
  findSupportTicketDetail: vi.fn(),
  findSupportTicketsWithStatus: vi.fn(),
  findSupportTicketContact: mockFindSupportTicketContact,
  markSupportTicketAdminReplied: mockMarkSupportTicketAdminReplied,
  markSupportTicketAdminReplyFailed: mockMarkSupportTicketAdminReplyFailed,
  closeSupportTicketByAdmin: vi.fn(),
  returnSupportTicketToCsrReview: mockReturnSupportTicketToCsrReview,
  failQueuedOrRunningSupportJobs: mockFailQueuedOrRunningSupportJobs,
  findCommittingSupportJob: mockFindCommittingSupportJob,
}))

vi.mock('@/lib/sms-support-sms', () => ({
  sendSupportSms: mockSendSupportSms,
}))

vi.mock('@/lib/sms-support-jobs', () => ({
  retrySupportAutomationJob: vi.fn(),
}))

import { createSupportTicketFromSubmission } from '@/app/admin/support/_actions/tickets'
import {
  markSupportTicketNeedsCsr,
  sendSupportTicketReply,
} from '@/app/admin/support/_actions/ticket-updates'

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
    mockFindSupportTicketContact.mockResolvedValue({
      id: 'ticket_123',
      phoneE164: '+15551234567',
      submissionId: 'sub_123',
    })
    mockCreateAdminSupportTicket.mockResolvedValue({ id: 'ticket_123' })
    mockAssignSupportTicketSubmission.mockResolvedValue(undefined)
    mockMarkSupportTicketAdminReplied.mockResolvedValue(undefined)
    mockMarkSupportTicketAdminReplyFailed.mockResolvedValue(undefined)
    mockReturnSupportTicketToCsrReview.mockResolvedValue({ submissionId: 'sub_123' })
    mockFindCommittingSupportJob.mockResolvedValue(null)
    mockFailQueuedOrRunningSupportJobs.mockResolvedValue(undefined)
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
    expect(mockReturnSupportTicketToCsrReview).toHaveBeenCalledWith('ticket_123')
    expect(mockFailQueuedOrRunningSupportJobs).toHaveBeenCalledWith('ticket_123', {
      lastError: 'Ticket escalated to admin before automation ran',
      completedAt: expect.any(Date),
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
    expect(mockMarkSupportTicketAdminReplied).toHaveBeenCalledWith('ticket_123')
    expect(mockFailQueuedOrRunningSupportJobs).toHaveBeenCalledWith('ticket_123', {
      lastError: 'Ticket replied to by admin before automation completed',
      completedAt: expect.any(Date),
    })
    expect(mockFailQueuedOrRunningSupportJobs.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendSupportSms.mock.invocationCallOrder[0]
    )
    expect(mockMarkSupportTicketAdminReplied.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendSupportSms.mock.invocationCallOrder[0]
    )
  })

  it('does not let admin reply while an automation job is finalizing the reissue', async () => {
    mockFindCommittingSupportJob.mockResolvedValue({ id: 'job_finalizing' })

    const result = await sendSupportTicketReply('ticket_123', 'We will handle this manually.')

    expect(result).toEqual({
      success: false,
      error: 'Automation is finalizing the updated note. Refresh in a moment before taking over.',
    })
    expect(mockSendSupportSms).not.toHaveBeenCalled()
    expect(mockMarkSupportTicketAdminReplied).not.toHaveBeenCalled()
    expect(mockMarkSupportTicketAdminReplyFailed).not.toHaveBeenCalled()
  })
})
