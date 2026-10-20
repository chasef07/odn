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
  mockStartAutomationRetry,
  mockFindActiveSupportAutomationJobId,
  mockFindLatestSupportAutomationJob,
  mockFindRunnableQueuedSupportJob,
  mockRunSupportTicketAutomation,
  mockAlertSupportTicketNeedsCsr,
} = vi.hoisted(() => ({
  mockTransition: vi.fn(),
  mockTransitionJob: vi.fn(),
  mockPermit: vi.fn(),
  mockStartAutomationRetry: vi.fn(),
  mockFindActiveSupportAutomationJobId: vi.fn(),
  mockFindLatestSupportAutomationJob: vi.fn(),
  mockFindRunnableQueuedSupportJob: vi.fn(),
  mockRunSupportTicketAutomation: vi.fn(),
  mockAlertSupportTicketNeedsCsr: vi.fn(),
}))

vi.mock('@/db/sms-support', () => ({
  findActiveSupportAutomationJobId: mockFindActiveSupportAutomationJobId,
  findLatestSupportAutomationJob: mockFindLatestSupportAutomationJob,
  findRunnableQueuedSupportJob: mockFindRunnableQueuedSupportJob,
}))

vi.mock('@/db/sms-support-lifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/sms-support-lifecycle')>()
  return {
    required: actual.required,
    transition: mockTransition,
    transitionJob: mockTransitionJob,
    permit: mockPermit,
    startAutomationRetry: mockStartAutomationRetry,
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

import { processSmsSupportJobNow, retrySupportAutomationJob } from '../sms-support-jobs'
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
    mockStartAutomationRetry.mockResolvedValue({
      ok: true,
      value: { ticket: { id: 'ticket_123' }, job: { id: 'job_retry' } },
    })
    mockFindRunnableQueuedSupportJob.mockResolvedValue(null)
  })

  it('requeues the failed job and restarts ticket automation with its summary', async () => {
    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({ success: true })
    expect(mockPermit).toHaveBeenCalledWith('ticket_123', 'retryAutomation')
    expect(mockStartAutomationRetry).toHaveBeenCalledWith('ticket_123', {
      at: expect.any(Date),
      summary: 'Change birthday to 1990-01-01',
      payload: dobPayload,
    })
    expect(mockFindRunnableQueuedSupportJob).toHaveBeenCalledWith('job_retry')
  })

  it('reports a ticket that left the failed state between the read and the retry, and runs no job', async () => {
    mockStartAutomationRetry.mockResolvedValue({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.CLOSED },
    })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({ success: false, error: 'Ticket is not in failed automation state' })
    expect(mockFindRunnableQueuedSupportJob).not.toHaveBeenCalled()
  })

  it('does not enqueue duplicate retry jobs when one is already active', async () => {
    mockFindActiveSupportAutomationJobId.mockResolvedValueOnce({ id: 'job_active' })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({ success: true })
    expect(mockFindActiveSupportAutomationJobId).toHaveBeenCalledWith('ticket_123')
    expect(mockStartAutomationRetry).not.toHaveBeenCalled()
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
    expect(mockStartAutomationRetry).not.toHaveBeenCalled()
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
    expect(mockStartAutomationRetry).not.toHaveBeenCalled()
  })

  it('reports a missing ticket', async () => {
    mockPermit.mockResolvedValue({ ok: false, refusal: { reason: 'missing' } })

    const result = await retrySupportAutomationJob('ticket_123')

    expect(result).toEqual({ success: false, error: 'Support ticket not found' })
    expect(mockStartAutomationRetry).not.toHaveBeenCalled()
  })
})

describe('processSmsSupportJobNow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindRunnableQueuedSupportJob.mockResolvedValue({ id: 'job_123', ticketId: 'ticket_123' })
    mockTransitionJob.mockResolvedValue({ ok: true, value: { id: 'job_123' } })
    mockRunSupportTicketAutomation.mockResolvedValue(undefined)
    mockTransition.mockResolvedValue({ ok: true, value: escalatedTicket })
  })

  it('runs a single queued job immediately when requested by the SMS flow', async () => {
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
    mockRunSupportTicketAutomation.mockRejectedValue(new Error('Resend timeout'))

    const result = await processSmsSupportJobNow('job_123', { workerId: 'test-worker' })

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
    mockRunSupportTicketAutomation.mockRejectedValue(
      new SupportAutomationManualReviewError(
        'Approval PDF options are unknown; admin must reissue this note manually'
      )
    )

    const result = await processSmsSupportJobNow('job_123', { workerId: 'test-worker' })

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
})
