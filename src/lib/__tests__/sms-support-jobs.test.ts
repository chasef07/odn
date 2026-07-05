import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '../sms-support-types'

const {
  mockTicketFindUnique,
  mockJobFindFirst,
  mockJobFindMany,
  mockJobCreate,
  mockJobUpdate,
  mockJobUpdateMany,
  mockTicketUpdate,
  mockRunSupportTicketAutomation,
  mockAlertSupportTicketNeedsCsr,
} = vi.hoisted(() => ({
  mockTicketFindUnique: vi.fn(),
  mockJobFindFirst: vi.fn(),
  mockJobFindMany: vi.fn(),
  mockJobCreate: vi.fn(),
  mockJobUpdate: vi.fn(),
  mockJobUpdateMany: vi.fn(),
  mockTicketUpdate: vi.fn(),
  mockRunSupportTicketAutomation: vi.fn(),
  mockAlertSupportTicketNeedsCsr: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    smsSupportTicket: {
      findUnique: mockTicketFindUnique,
      update: mockTicketUpdate,
    },
    smsSupportJob: {
      findFirst: mockJobFindFirst,
      findMany: mockJobFindMany,
      create: mockJobCreate,
      update: mockJobUpdate,
      updateMany: mockJobUpdateMany,
    },
  },
}))

vi.mock('@/lib/sms-support-automation', () => ({
  automationSummary: vi.fn(() => 'Change birthday to 1990-01-01'),
  parseAutomationPayload: vi.fn((payload) => payload),
  runSupportTicketAutomation: mockRunSupportTicketAutomation,
  SupportAutomationCancelledError: class SupportAutomationCancelledError extends Error {},
  SupportAutomationManualReviewError: class SupportAutomationManualReviewError extends Error {},
}))

vi.mock('@/lib/sms-support-alerts', () => ({
  alertSupportTicketNeedsCsr: mockAlertSupportTicketNeedsCsr,
}))

import {
  enqueueSupportAutomationJob,
  processSmsSupportJobNow,
  processQueuedSmsSupportJobs,
  retrySupportAutomationJob,
  SupportAutomationPayloadConflictError,
} from '../sms-support-jobs'
import {
  SupportAutomationManualReviewError,
  type SupportAutomationPayload,
} from '../sms-support-automation'

const dobPayload = {
  kind: 'UPDATE_DOB_REISSUE_NOTE',
  category: 'CHANGE_DOB',
  updates: { patientDateOfBirth: '1990-01-01' },
} satisfies SupportAutomationPayload

describe('enqueueSupportAutomationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates the active job directly instead of relying on a pre-read', async () => {
    mockJobCreate.mockResolvedValue({ id: 'job_new' })

    const result = await enqueueSupportAutomationJob({
      ticketId: 'ticket_123',
      payload: dobPayload,
    })

    expect(result).toEqual({ id: 'job_new' })
    expect(mockJobFindFirst).not.toHaveBeenCalled()
    expect(mockJobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: 'ticket_123',
        kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
        status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      }),
    })
  })

  it('returns the existing active job after a unique-index race', async () => {
    mockJobCreate.mockRejectedValue({ code: 'P2002' })
    mockJobFindFirst.mockResolvedValue({
      id: 'job_active',
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: dobPayload,
    })

    const result = await enqueueSupportAutomationJob({
      ticketId: 'ticket_123',
      payload: dobPayload,
    })

    expect(result).toEqual(
      expect.objectContaining({ id: 'job_active', status: SMS_SUPPORT_JOB_STATUS.QUEUED })
    )
    expect(mockJobFindFirst).toHaveBeenCalledWith({
      where: {
        ticketId: 'ticket_123',
        kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
        status: {
          in: [
            SMS_SUPPORT_JOB_STATUS.QUEUED,
            SMS_SUPPORT_JOB_STATUS.RUNNING,
            SMS_SUPPORT_JOB_STATUS.COMMITTING,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('rejects a unique-index race when the active job payload is different', async () => {
    mockJobCreate.mockRejectedValue({ code: 'P2002' })
    mockJobFindFirst.mockResolvedValue({
      id: 'job_active',
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: dobPayload,
    })

    await expect(
      enqueueSupportAutomationJob({
        ticketId: 'ticket_123',
        payload: {
          kind: 'UPDATE_PURPOSE_REISSUE_NOTE',
          category: 'CHANGE_PURPOSE',
          updates: { notePurpose: 'school', otherNotePurpose: null },
        },
      })
    ).rejects.toBeInstanceOf(SupportAutomationPayloadConflictError)
  })
})

describe('retrySupportAutomationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTicketFindUnique.mockResolvedValue({
      id: 'ticket_123',
      automationKind: 'UPDATE_DOB_REISSUE_NOTE',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
      collectedData: null,
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    })
  })

  it('does not enqueue duplicate retry jobs when one is already active', async () => {
    mockJobFindFirst.mockResolvedValueOnce({
      id: 'job_active',
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
    })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({ success: true })
    expect(mockJobCreate).not.toHaveBeenCalled()
    expect(mockTicketUpdate).not.toHaveBeenCalled()
  })

  it('does not retry an old failed job after the ticket has recovered', async () => {
    mockTicketFindUnique.mockResolvedValue({
      id: 'ticket_123',
      automationKind: 'UPDATE_DOB_REISSUE_NOTE',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED,
      collectedData: null,
      status: SMS_SUPPORT_STATUS.CLOSED,
    })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({
      success: false,
      error: 'Ticket is not in failed automation state',
    })
    expect(mockJobCreate).not.toHaveBeenCalled()
    expect(mockTicketUpdate).not.toHaveBeenCalled()
  })
})

describe('processQueuedSmsSupportJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJobFindMany.mockResolvedValue([])
    mockJobUpdateMany.mockResolvedValue({ count: 1 })
    mockRunSupportTicketAutomation.mockResolvedValue(undefined)
    mockTicketUpdate.mockResolvedValue({
      id: 'ticket_123',
      phoneE164: '+15551234567',
      category: 'CHANGE_DOB',
      submissionId: 'sub_123',
    })
  })

  it('recovers stale running jobs before selecting queued work', async () => {
    const result = await processQueuedSmsSupportJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 })
    expect(mockJobUpdateMany).toHaveBeenCalledWith({
      where: {
        status: SMS_SUPPORT_JOB_STATUS.RUNNING,
        lockedAt: { lt: expect.any(Date) },
      },
      data: {
        status: SMS_SUPPORT_JOB_STATUS.QUEUED,
        lockedAt: null,
        lockedBy: null,
        lastError: 'Recovered stale running job lock',
        runAfter: expect.any(Date),
      },
    })
    expect(mockJobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: SMS_SUPPORT_JOB_STATUS.QUEUED,
          ticket: {
            status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
            automationStatus: {
              in: [SMS_SUPPORT_AUTOMATION_STATUS.QUEUED, SMS_SUPPORT_AUTOMATION_STATUS.RUNNING],
            },
          },
        }),
      })
    )
  })

  it('runs a single queued job immediately when requested by the SMS flow', async () => {
    mockJobFindFirst.mockResolvedValue({
      id: 'job_123',
      ticketId: 'ticket_123',
    })

    const result = await processSmsSupportJobNow('job_123', { workerId: 'sms-inbound-test' })

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 })
    expect(mockJobFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'job_123',
        status: SMS_SUPPORT_JOB_STATUS.QUEUED,
        runAfter: { lte: expect.any(Date) },
        ticket: {
          status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
          automationStatus: {
            in: [SMS_SUPPORT_AUTOMATION_STATUS.QUEUED, SMS_SUPPORT_AUTOMATION_STATUS.RUNNING],
          },
        },
      },
      select: {
        id: true,
        ticketId: true,
      },
    })
    expect(mockJobUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'job_123',
        status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      },
      data: expect.objectContaining({
        status: SMS_SUPPORT_JOB_STATUS.RUNNING,
        lockedBy: 'sms-inbound-test',
      }),
    })
    expect(mockRunSupportTicketAutomation).toHaveBeenCalledWith('job_123')
    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
        lastError: null,
      }),
    })
  })

  it('escalates automation failures instead of rescheduling hidden cron work', async () => {
    mockJobFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'job_123',
        ticketId: 'ticket_123',
        attempts: 0,
      },
    ])
    mockRunSupportTicketAutomation.mockRejectedValue(new Error('Resend timeout'))

    const result = await processQueuedSmsSupportJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 })
    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_JOB_STATUS.FAILED,
        lastError: 'Resend timeout',
      }),
    })
    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
        failureReason: 'Resend timeout',
      }),
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        summary: expect.stringContaining('failed and needs admin review'),
      })
    )
  })

  it('escalates manual-review automation failures without retrying', async () => {
    mockJobFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'job_123',
        ticketId: 'ticket_123',
        attempts: 0,
      },
    ])
    mockRunSupportTicketAutomation.mockRejectedValue(
      new SupportAutomationManualReviewError(
        'Approval PDF options are unknown; admin must reissue this note manually'
      )
    )

    const result = await processQueuedSmsSupportJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 })
    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_JOB_STATUS.FAILED,
        lastError: 'Approval PDF options are unknown; admin must reissue this note manually',
      }),
    })
    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
        failureReason: 'Approval PDF options are unknown; admin must reissue this note manually',
      }),
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        summary: expect.stringContaining('requires admin review'),
      })
    )
  })

  it('escalates stale finalizing jobs so tickets do not stay stuck', async () => {
    mockJobFindMany.mockResolvedValueOnce([
      {
        id: 'job_finalizing',
        ticketId: 'ticket_123',
        status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
        lockedAt: new Date('2026-06-29T12:00:00Z'),
        ticket: {
          id: 'ticket_123',
          phoneE164: '+15551234567',
          category: 'CHANGE_DOB',
          submissionId: 'sub_123',
        },
      },
    ])
    mockJobFindMany.mockResolvedValueOnce([])

    const result = await processQueuedSmsSupportJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 })
    expect(mockJobUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'job_finalizing',
        status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
        lockedAt: { lt: expect.any(Date) },
      },
      data: expect.objectContaining({
        status: SMS_SUPPORT_JOB_STATUS.FAILED,
        lastError: expect.stringContaining('stalled while finalizing'),
      }),
    })
    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
        failureReason: expect.stringContaining('stalled while finalizing'),
      }),
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        summary: expect.stringContaining('stalled while finalizing'),
      })
    )
  })
})
