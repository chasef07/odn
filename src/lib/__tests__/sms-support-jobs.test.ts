import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '../sms-support-types'

const {
  mockTransition,
  mockTransitionJob,
  mockPermit,
  mockCreateRetrySupportAutomationJob,
  mockCreateSupportAutomationJob,
  mockRequeueStaleSupportJobs,
  mockFindActiveSupportAutomationJob,
  mockFindActiveSupportAutomationJobId,
  mockFindLatestSupportAutomationJob,
  mockFindRunnableQueuedSupportJob,
  mockFindRunnableQueuedSupportJobs,
  mockFindStaleCommittingSupportJobs,
  mockRunSupportTicketAutomation,
  mockAlertSupportTicketNeedsCsr,
} = vi.hoisted(() => ({
  mockTransition: vi.fn(),
  mockTransitionJob: vi.fn(),
  mockPermit: vi.fn(),
  mockCreateRetrySupportAutomationJob: vi.fn(),
  mockCreateSupportAutomationJob: vi.fn(),
  mockRequeueStaleSupportJobs: vi.fn(),
  mockFindActiveSupportAutomationJob: vi.fn(),
  mockFindActiveSupportAutomationJobId: vi.fn(),
  mockFindLatestSupportAutomationJob: vi.fn(),
  mockFindRunnableQueuedSupportJob: vi.fn(),
  mockFindRunnableQueuedSupportJobs: vi.fn(),
  mockFindStaleCommittingSupportJobs: vi.fn(),
  mockRunSupportTicketAutomation: vi.fn(),
  mockAlertSupportTicketNeedsCsr: vi.fn(),
}))

vi.mock('@/db/sms-support', () => ({
  findActiveSupportAutomationJob: mockFindActiveSupportAutomationJob,
  findActiveSupportAutomationJobId: mockFindActiveSupportAutomationJobId,
  findLatestSupportAutomationJob: mockFindLatestSupportAutomationJob,
  findRunnableQueuedSupportJob: mockFindRunnableQueuedSupportJob,
  findRunnableQueuedSupportJobs: mockFindRunnableQueuedSupportJobs,
  findStaleCommittingSupportJobs: mockFindStaleCommittingSupportJobs,
}))

vi.mock('@/db/sms-support-lifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/sms-support-lifecycle')>()
  return {
    required: actual.required,
    transition: mockTransition,
    transitionJob: mockTransitionJob,
    permit: mockPermit,
    createRetrySupportAutomationJob: mockCreateRetrySupportAutomationJob,
    createSupportAutomationJob: mockCreateSupportAutomationJob,
    requeueStaleSupportJobs: mockRequeueStaleSupportJobs,
  }
})

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

const escalatedTicket = {
  id: 'ticket_123',
  phoneE164: '+15551234567',
  category: 'CHANGE_DOB',
  submissionId: 'sub_123',
}

describe('enqueueSupportAutomationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates the active job directly instead of relying on a pre-read', async () => {
    mockCreateSupportAutomationJob.mockResolvedValue({ id: 'job_new' })

    const result = await enqueueSupportAutomationJob({
      ticketId: 'ticket_123',
      payload: dobPayload,
    })

    expect(result).toEqual({ id: 'job_new' })
    expect(mockFindActiveSupportAutomationJob).not.toHaveBeenCalled()
    expect(mockCreateSupportAutomationJob).toHaveBeenCalledWith({
      ticketId: 'ticket_123',
      payload: dobPayload,
    })
  })

  it('returns the existing active job after a unique-index race', async () => {
    mockCreateSupportAutomationJob.mockResolvedValue(null)
    mockFindActiveSupportAutomationJob.mockResolvedValue({
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
    expect(mockFindActiveSupportAutomationJob).toHaveBeenCalledWith('ticket_123')
  })

  it('rejects a unique-index race when the active job payload is different', async () => {
    mockCreateSupportAutomationJob.mockResolvedValue(null)
    mockFindActiveSupportAutomationJob.mockResolvedValue({
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
    mockPermit.mockResolvedValue({
      ok: true,
      value: {
        id: 'ticket_123',
        automationKind: 'UPDATE_DOB_REISSUE_NOTE',
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
        collectedData: null,
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      },
    })
    mockFindActiveSupportAutomationJobId.mockResolvedValue(null)
    mockFindLatestSupportAutomationJob.mockResolvedValue({
      id: 'job_failed',
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      payload: dobPayload,
    })
    mockCreateRetrySupportAutomationJob.mockResolvedValue({ id: 'job_retry' })
    mockTransition.mockResolvedValue({ ok: true, value: { id: 'ticket_123' } })
    mockFindRunnableQueuedSupportJob.mockResolvedValue(null)
  })

  it('requeues the failed job and restarts ticket automation with its summary', async () => {
    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({ success: true })
    expect(mockPermit).toHaveBeenCalledWith('ticket_123', 'retryAutomation')
    expect(mockCreateRetrySupportAutomationJob).toHaveBeenCalledWith({
      ticketId: 'ticket_123',
      payload: dobPayload,
    })
    expect(mockTransition).toHaveBeenCalledWith('retryAutomation', 'ticket_123', {
      at: expect.any(Date),
      summary: 'Change birthday to 1990-01-01',
    })
    expect(mockFindRunnableQueuedSupportJob).toHaveBeenCalledWith('job_retry')
  })

  it('does not enqueue duplicate retry jobs when one is already active', async () => {
    mockFindActiveSupportAutomationJobId.mockResolvedValueOnce({ id: 'job_active' })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({ success: true })
    expect(mockFindActiveSupportAutomationJobId).toHaveBeenCalledWith('ticket_123')
    expect(mockCreateRetrySupportAutomationJob).not.toHaveBeenCalled()
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('does not retry an old failed job after the ticket has recovered', async () => {
    mockPermit.mockResolvedValue({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.CLOSED },
    })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({
      success: false,
      error: 'Ticket is not in failed automation state',
    })
    expect(mockCreateRetrySupportAutomationJob).not.toHaveBeenCalled()
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('does not retry a ticket whose automation did not fail', async () => {
    mockPermit.mockResolvedValue({
      ok: false,
      refusal: { reason: 'automation', automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED },
    })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({
      success: false,
      error: 'Ticket is not in failed automation state',
    })
    expect(mockCreateRetrySupportAutomationJob).not.toHaveBeenCalled()
  })

  it('reports a missing ticket', async () => {
    mockPermit.mockResolvedValue({ ok: false, refusal: { reason: 'missing' } })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({ success: false, error: 'Support ticket not found' })
    expect(mockCreateRetrySupportAutomationJob).not.toHaveBeenCalled()
  })
})

describe('processQueuedSmsSupportJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindStaleCommittingSupportJobs.mockResolvedValue([])
    mockFindRunnableQueuedSupportJobs.mockResolvedValue([])
    mockTransitionJob.mockResolvedValue({ ok: true, value: { id: 'job_123' } })
    mockRunSupportTicketAutomation.mockResolvedValue(undefined)
    mockTransition.mockResolvedValue({ ok: true, value: escalatedTicket })
  })

  it('recovers stale running jobs before selecting queued work', async () => {
    const result = await processQueuedSmsSupportJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 })
    expect(mockRequeueStaleSupportJobs).toHaveBeenCalledWith(expect.any(Date), {
      at: expect.any(Date),
    })
    expect(mockFindRunnableQueuedSupportJobs).toHaveBeenCalledWith(1)
    expect(mockRequeueStaleSupportJobs.mock.invocationCallOrder[0]).toBeLessThan(
      mockFindRunnableQueuedSupportJobs.mock.invocationCallOrder[0]
    )
  })

  it('runs a single queued job immediately when requested by the SMS flow', async () => {
    mockFindRunnableQueuedSupportJob.mockResolvedValue({
      id: 'job_123',
      ticketId: 'ticket_123',
    })

    const result = await processSmsSupportJobNow('job_123', { workerId: 'sms-inbound-test' })

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 })
    expect(mockFindRunnableQueuedSupportJob).toHaveBeenCalledWith('job_123')
    expect(mockTransitionJob).toHaveBeenCalledWith('claim', 'job_123', {
      at: expect.any(Date),
      workerId: 'sms-inbound-test',
    })
    expect(mockRunSupportTicketAutomation).toHaveBeenCalledWith('job_123')
    expect(mockTransitionJob).toHaveBeenCalledWith('complete', 'job_123', {
      at: expect.any(Date),
    })
  })

  it('skips a queued job another worker already claimed', async () => {
    mockFindRunnableQueuedSupportJob.mockResolvedValue({
      id: 'job_123',
      ticketId: 'ticket_123',
    })
    mockTransitionJob.mockResolvedValue({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_JOB_STATUS.RUNNING },
    })

    const result = await processSmsSupportJobNow('job_123', { workerId: 'sms-inbound-test' })

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 })
    expect(mockRunSupportTicketAutomation).not.toHaveBeenCalled()
    expect(mockTransition).not.toHaveBeenCalled()
  })

  it('escalates automation failures instead of rescheduling hidden cron work', async () => {
    mockFindRunnableQueuedSupportJobs.mockResolvedValueOnce([
      {
        id: 'job_123',
        ticketId: 'ticket_123',
        attempts: 0,
      },
    ])
    mockRunSupportTicketAutomation.mockRejectedValue(new Error('Resend timeout'))

    const result = await processQueuedSmsSupportJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 })
    expect(mockTransitionJob).toHaveBeenCalledWith('fail', 'job_123', {
      at: expect.any(Date),
      lastError: 'Resend timeout',
    })
    expect(mockTransition).toHaveBeenCalledWith('automationFailed', 'ticket_123', {
      at: expect.any(Date),
      failureReason: 'Resend timeout',
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        summary: expect.stringContaining('failed and needs admin review'),
      })
    )
  })

  it('escalates manual-review automation failures without retrying', async () => {
    mockFindRunnableQueuedSupportJobs.mockResolvedValueOnce([
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
    expect(mockTransitionJob).toHaveBeenCalledWith('fail', 'job_123', {
      at: expect.any(Date),
      lastError: 'Approval PDF options are unknown; admin must reissue this note manually',
    })
    expect(mockTransition).toHaveBeenCalledWith('automationFailed', 'ticket_123', {
      at: expect.any(Date),
      failureReason: 'Approval PDF options are unknown; admin must reissue this note manually',
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        summary: expect.stringContaining('requires admin review'),
      })
    )
  })

  it('escalates stale finalizing jobs so tickets do not stay stuck', async () => {
    mockFindStaleCommittingSupportJobs.mockResolvedValueOnce([
      {
        id: 'job_finalizing',
        ticketId: 'ticket_123',
        status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
        lockedAt: new Date('2026-06-29T12:00:00Z'),
        ticket: escalatedTicket,
      },
    ])

    const result = await processQueuedSmsSupportJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 })
    expect(mockFindStaleCommittingSupportJobs).toHaveBeenCalledWith(expect.any(Date), 1)
    expect(mockTransitionJob).toHaveBeenCalledWith('failStale', 'job_finalizing', {
      at: expect.any(Date),
      lastError: expect.stringContaining('stalled while finalizing'),
    })
    expect(mockTransition).toHaveBeenCalledWith('automationFailed', 'ticket_123', {
      at: expect.any(Date),
      failureReason: expect.stringContaining('stalled while finalizing'),
    })
    expect(mockAlertSupportTicketNeedsCsr).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket_123',
        summary: expect.stringContaining('stalled while finalizing'),
      })
    )
  })

  it('leaves a stale finalizing job alone when it finished before it could be failed', async () => {
    mockFindStaleCommittingSupportJobs.mockResolvedValueOnce([
      { id: 'job_finalizing', ticketId: 'ticket_123' },
    ])
    mockTransitionJob.mockResolvedValue({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED },
    })

    const result = await processQueuedSmsSupportJobs({ limit: 1, workerId: 'test-worker' })

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 })
    expect(mockTransition).not.toHaveBeenCalled()
    expect(mockAlertSupportTicketNeedsCsr).not.toHaveBeenCalled()
  })
})
