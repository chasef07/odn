import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetSession,
  mockSubmissionFindUnique,
  mockSmsPhoneStateFindUnique,
  mockSmsSupportTicketFindFirst,
  mockSmsSupportTicketFindUnique,
  mockSmsSupportTicketCreate,
  mockSmsSupportTicketUpdate,
  mockSmsSupportJobFindFirst,
  mockSmsSupportJobUpdateMany,
  mockSendSupportSms,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSubmissionFindUnique: vi.fn(),
  mockSmsPhoneStateFindUnique: vi.fn(),
  mockSmsSupportTicketFindFirst: vi.fn(),
  mockSmsSupportTicketFindUnique: vi.fn(),
  mockSmsSupportTicketCreate: vi.fn(),
  mockSmsSupportTicketUpdate: vi.fn(),
  mockSmsSupportJobFindFirst: vi.fn(),
  mockSmsSupportJobUpdateMany: vi.fn(),
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

vi.mock('@/lib/prisma', () => ({
  default: {
    submission: {
      findUnique: mockSubmissionFindUnique,
    },
    smsPhoneState: {
      findUnique: mockSmsPhoneStateFindUnique,
    },
    smsSupportTicket: {
      findFirst: mockSmsSupportTicketFindFirst,
      findUnique: mockSmsSupportTicketFindUnique,
      create: mockSmsSupportTicketCreate,
      update: mockSmsSupportTicketUpdate,
    },
    smsSupportJob: {
      findFirst: mockSmsSupportJobFindFirst,
      updateMany: mockSmsSupportJobUpdateMany,
    },
  },
}))

vi.mock('@/lib/sms-support-sms', () => ({
  sendSupportSms: mockSendSupportSms,
}))

vi.mock('@/lib/sms-support-jobs', () => ({
  processQueuedSmsSupportJobs: vi.fn(),
  retrySupportAutomationJob: vi.fn(),
}))

import {
  createSupportTicketFromSubmission,
  markSupportTicketNeedsCsr,
  sendSupportTicketReply,
} from './actions'

describe('createSupportTicketFromSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: 'admin_123' },
    })
    mockSubmissionFindUnique.mockResolvedValue({
      id: 'sub_123',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
      patientFirstName: 'Jane',
      patientLastName: 'Doe',
    })
    mockSmsPhoneStateFindUnique.mockResolvedValue(null)
    mockSmsSupportTicketFindFirst.mockResolvedValue(null)
    mockSmsSupportTicketFindUnique.mockResolvedValue({
      id: 'ticket_123',
      phoneE164: '+15551234567',
      submissionId: 'sub_123',
    })
    mockSmsSupportTicketCreate.mockResolvedValue({ id: 'ticket_123' })
    mockSmsSupportTicketUpdate.mockResolvedValue({ submissionId: 'sub_123' })
    mockSmsSupportJobFindFirst.mockResolvedValue(null)
    mockSmsSupportJobUpdateMany.mockResolvedValue({ count: 1 })
    mockSendSupportSms.mockResolvedValue({ success: true })
  })

  it('blocks admin-created SMS tickets when the phone has opted out', async () => {
    mockSmsPhoneStateFindUnique.mockResolvedValue({
      optedOutAt: new Date('2026-06-29T12:00:00Z'),
    })

    const result = await createSupportTicketFromSubmission('sub_123')

    expect(result).toEqual({
      success: false,
      error: 'Phone number is opted out of SMS. Customer must text START before SMS support.',
    })
    expect(mockSmsPhoneStateFindUnique).toHaveBeenCalledWith({
      where: { phoneE164: '+15551234567' },
      select: { optedOutAt: true },
    })
    expect(mockSmsSupportTicketCreate).not.toHaveBeenCalled()
  })

  it('reuses an active ticket for the selected submission only', async () => {
    mockSmsSupportTicketFindFirst.mockResolvedValue({ id: 'ticket_existing' })

    const result = await createSupportTicketFromSubmission('sub_123')

    expect(result).toEqual({ success: true, ticketId: 'ticket_existing' })
    expect(mockSmsSupportTicketFindFirst).toHaveBeenCalledWith({
      where: {
        phoneE164: '+15551234567',
        submissionId: 'sub_123',
        status: { in: ['OPEN', 'WAITING_CUSTOMER', 'RUNNING_AUTOMATION', 'NEEDS_CSR'] },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })
    expect(mockSmsSupportTicketCreate).not.toHaveBeenCalled()
  })

  it('cancels queued automation jobs when staff escalates a ticket to admin', async () => {
    const result = await markSupportTicketNeedsCsr('ticket_123')

    expect(result).toEqual({ success: true })
    expect(mockSmsSupportTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: 'NEEDS_CSR',
        state: 'CSR_REVIEW',
      }),
      select: { submissionId: true },
    })
    expect(mockSmsSupportJobUpdateMany).toHaveBeenCalledWith({
      where: {
        ticketId: 'ticket_123',
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'Ticket escalated to admin by staff before automation ran',
      }),
    })
  })

  it('cancels queued automation jobs when staff replies by SMS', async () => {
    const result = await sendSupportTicketReply('ticket_123', 'We will handle this manually.')

    expect(result).toEqual({ success: true })
    expect(mockSendSupportSms).toHaveBeenCalledWith({
      ticketId: 'ticket_123',
      submissionId: 'sub_123',
      toPhone: '+15551234567',
      type: 'SUPPORT_REPLY',
      body: 'We will handle this manually.',
    })
    expect(mockSmsSupportTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: 'OPEN',
        state: 'CSR_REVIEW',
      }),
    })
    expect(mockSmsSupportJobUpdateMany).toHaveBeenCalledWith({
      where: {
        ticketId: 'ticket_123',
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'Ticket replied to by staff before automation completed',
      }),
    })
    expect(mockSmsSupportJobUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendSupportSms.mock.invocationCallOrder[0]
    )
    expect(mockSmsSupportTicketUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendSupportSms.mock.invocationCallOrder[0]
    )
  })

  it('does not let staff reply while an automation job is finalizing the reissue', async () => {
    mockSmsSupportJobFindFirst.mockResolvedValue({ id: 'job_finalizing' })

    const result = await sendSupportTicketReply('ticket_123', 'We will handle this manually.')

    expect(result).toEqual({
      success: false,
      error: 'Automation is finalizing the updated note. Refresh in a moment before taking over.',
    })
    expect(mockSendSupportSms).not.toHaveBeenCalled()
    expect(mockSmsSupportTicketUpdate).not.toHaveBeenCalled()
  })
})
