import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'

const {
  mockPhoneStateFindUnique,
  mockPhoneStateUpsert,
  mockMessageUpsert,
  mockMessageUpdateMany,
  mockTicketCreate,
  mockTicketFindFirst,
  mockTicketUpdate,
  mockTicketUpdateMany,
  mockJobCreate,
  mockJobFindFirst,
  mockJobFindMany,
  mockJobUpdate,
  mockJobUpdateMany,
} = vi.hoisted(() => ({
  mockPhoneStateFindUnique: vi.fn(),
  mockPhoneStateUpsert: vi.fn(),
  mockMessageUpsert: vi.fn(),
  mockMessageUpdateMany: vi.fn(),
  mockTicketCreate: vi.fn(),
  mockTicketFindFirst: vi.fn(),
  mockTicketUpdate: vi.fn(),
  mockTicketUpdateMany: vi.fn(),
  mockJobCreate: vi.fn(),
  mockJobFindFirst: vi.fn(),
  mockJobFindMany: vi.fn(),
  mockJobUpdate: vi.fn(),
  mockJobUpdateMany: vi.fn(),
}))

vi.mock('../client', () => ({
  default: {
    smsPhoneState: {
      findUnique: mockPhoneStateFindUnique,
      upsert: mockPhoneStateUpsert,
    },
    smsMessage: {
      upsert: mockMessageUpsert,
      updateMany: mockMessageUpdateMany,
    },
    smsSupportTicket: {
      create: mockTicketCreate,
      findFirst: mockTicketFindFirst,
      update: mockTicketUpdate,
      updateMany: mockTicketUpdateMany,
    },
    smsSupportJob: {
      create: mockJobCreate,
      findFirst: mockJobFindFirst,
      findMany: mockJobFindMany,
      update: mockJobUpdate,
      updateMany: mockJobUpdateMany,
    },
  },
}))

import {
  assignSupportTicketSubmission,
  claimQueuedSupportJob,
  claimSupportTicketAutomationRun,
  completeSupportJob,
  createInboundSupportTicket,
  createSupportAutomationJob,
  escalateSupportTicketAfterAutomationFailure,
  escalateSupportTicketToCsr,
  failQueuedOrRunningSupportJobs,
  failStaleCommittingSupportJob,
  failSupportJob,
  findActiveSupportAutomationJob,
  findActiveSupportTicketSummaryForPhone,
  findRunnableQueuedSupportJob,
  findRunnableQueuedSupportJobs,
  findSmsPhoneConsentState,
  findSmsPhoneOptOut,
  linkSmsMessageToSupportTicket,
  markSmsMessageSupportHandled,
  markSupportTicketAdminReplied,
  markSupportTicketReplyFailed,
  recordSmsMessageFinalized,
  recordSmsMessageSent,
  recordSmsPhoneOptOut,
  recordSupportTicketInbound,
  requeueStaleRunningSupportJobs,
  returnSupportTicketToCsrReview,
  updateSupportTicketConversation,
  upsertInboundSmsMessage,
} from '../sms-support'

const occurredAt = new Date('2026-06-16T12:00:00.000Z')
const dobPayload = {
  kind: 'UPDATE_DOB_REISSUE_NOTE',
  category: 'CHANGE_DOB',
  updates: { patientDateOfBirth: '1990-01-01' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('findSmsPhoneOptOut', () => {
  it('reads only the opt-out time for the phone', async () => {
    mockPhoneStateFindUnique.mockResolvedValue({ optedOutAt: occurredAt })

    await expect(findSmsPhoneOptOut('+15551234567')).resolves.toEqual({ optedOutAt: occurredAt })
    expect(mockPhoneStateFindUnique).toHaveBeenCalledWith({
      where: { phoneE164: '+15551234567' },
      select: { optedOutAt: true },
    })
  })
})

describe('findSmsPhoneConsentState', () => {
  it('reads the opt-out and opt-in times for the phone', async () => {
    mockPhoneStateFindUnique.mockResolvedValue(null)

    await expect(findSmsPhoneConsentState('+15551234567')).resolves.toBeNull()
    expect(mockPhoneStateFindUnique).toHaveBeenCalledWith({
      where: { phoneE164: '+15551234567' },
      select: { optedOutAt: true, lastOptInAt: true },
    })
  })
})

describe('recordSmsPhoneOptOut', () => {
  it('upserts the opt-out time for the phone', async () => {
    mockPhoneStateUpsert.mockResolvedValue({})

    await recordSmsPhoneOptOut('+15551234567', occurredAt)

    expect(mockPhoneStateUpsert).toHaveBeenCalledWith({
      where: { phoneE164: '+15551234567' },
      update: { optedOutAt: occurredAt },
      create: { phoneE164: '+15551234567', optedOutAt: occurredAt },
    })
  })
})

describe('upsertInboundSmsMessage', () => {
  it('records the raw inbound SMS keyed by provider message id', async () => {
    mockMessageUpsert.mockResolvedValue({})

    await upsertInboundSmsMessage({
      providerMessageId: 'msg_123',
      submissionId: 'sub_123',
      to: '+18885551212',
      from: '+15551234567',
      body: 'HELP',
      providerStatus: 'sent',
      receivedAt: occurredAt,
    })

    expect(mockMessageUpsert).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_123' },
      update: {
        providerStatus: 'sent',
        receivedAt: occurredAt,
      },
      create: {
        submissionId: 'sub_123',
        type: 'INBOUND',
        direction: 'inbound',
        to: '+18885551212',
        from: '+15551234567',
        body: 'HELP',
        providerMessageId: 'msg_123',
        providerStatus: 'sent',
        receivedAt: occurredAt,
      },
    })
  })
})

describe('recordSmsMessageSent', () => {
  it('does not let late sent events overwrite finalized SMS state', async () => {
    mockMessageUpdateMany.mockResolvedValue({ count: 1 })

    await recordSmsMessageSent('msg_123', { providerStatus: 'sent', sentAt: occurredAt })

    expect(mockMessageUpdateMany).toHaveBeenCalledWith({
      where: {
        providerMessageId: 'msg_123',
        finalizedAt: null,
      },
      data: {
        providerStatus: 'sent',
        sentAt: occurredAt,
      },
    })
  })
})

describe('recordSmsMessageFinalized', () => {
  const receipt = {
    providerStatus: 'delivered',
    errorCode: null,
    errorMessage: null,
    finalizedAt: occurredAt,
  }

  it('finalizes the message and returns the matched count', async () => {
    mockMessageUpdateMany.mockResolvedValue({ count: 1 })

    await expect(recordSmsMessageFinalized('msg_123', receipt)).resolves.toBe(1)
    expect(mockMessageUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_123' },
      data: receipt,
    })
  })

  it('returns 0 for an unmatched receipt', async () => {
    mockMessageUpdateMany.mockResolvedValue({ count: 0 })

    await expect(recordSmsMessageFinalized('msg_missing', receipt)).resolves.toBe(0)
  })
})

describe('markSmsMessageSupportHandled', () => {
  it('stamps the support-handled time on the inbound SMS', async () => {
    mockMessageUpdateMany.mockResolvedValue({ count: 1 })

    await markSmsMessageSupportHandled('msg_123')

    expect(mockMessageUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_123' },
      data: { supportHandledAt: expect.any(Date) },
    })
  })
})

describe('findActiveSupportTicketSummaryForPhone', () => {
  it('finds the most recent active ticket for the phone', async () => {
    const ticket = { id: 'ticket_existing', status: 'OPEN', submissionId: null }
    mockTicketFindFirst.mockResolvedValue(ticket)

    await expect(findActiveSupportTicketSummaryForPhone('+15551234567')).resolves.toEqual(ticket)
    expect(mockTicketFindFirst).toHaveBeenCalledWith({
      where: {
        phoneE164: '+15551234567',
        status: { in: ['OPEN', 'WAITING_CUSTOMER', 'RUNNING_AUTOMATION', 'NEEDS_CSR'] },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, status: true, submissionId: true },
    })
  })
})

describe('assignSupportTicketSubmission', () => {
  it('links the ticket to the submission', async () => {
    mockTicketUpdate.mockResolvedValue({})

    await assignSupportTicketSubmission('ticket_existing', 'sub_123')

    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_existing' },
      data: { submissionId: 'sub_123' },
    })
  })
})

describe('returnSupportTicketToCsrReview', () => {
  it('moves the ticket to CSR review and returns its submission id', async () => {
    mockTicketUpdate.mockResolvedValue({ submissionId: 'sub_123' })

    await expect(returnSupportTicketToCsrReview('ticket_123')).resolves.toEqual({
      submissionId: 'sub_123',
    })
    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: 'NEEDS_CSR',
        state: 'CSR_REVIEW',
      }),
      select: { submissionId: true },
    })
  })
})

describe('markSupportTicketAdminReplied', () => {
  it('reopens the ticket for CSR review and clears prior alert state', async () => {
    mockTicketUpdate.mockResolvedValue({})

    await markSupportTicketAdminReplied('ticket_123')

    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: 'OPEN',
        state: 'CSR_REVIEW',
        adminSummary: 'Admin replied by SMS.',
        csrAlertedAt: null,
      }),
    })
  })
})

describe('failQueuedOrRunningSupportJobs', () => {
  it('fails queued and running jobs when admin marks a ticket for review', async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 1 })

    await failQueuedOrRunningSupportJobs('ticket_123', {
      lastError: 'Ticket escalated to admin before automation ran',
      completedAt: occurredAt,
    })

    expect(mockJobUpdateMany).toHaveBeenCalledWith({
      where: {
        ticketId: 'ticket_123',
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'Ticket escalated to admin before automation ran',
      }),
    })
  })

  it('fails queued and running jobs when admin replies by SMS', async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 1 })

    await failQueuedOrRunningSupportJobs('ticket_123', {
      lastError: 'Ticket replied to by admin before automation completed',
      completedAt: occurredAt,
    })

    expect(mockJobUpdateMany).toHaveBeenCalledWith({
      where: {
        ticketId: 'ticket_123',
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'Ticket replied to by admin before automation completed',
      }),
    })
  })

  it('fails only the queued and running jobs for the ticket', async () => {
    await failQueuedOrRunningSupportJobs('ticket_123', {
      lastError: 'Support SMS failed before automation completed',
      completedAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockJobUpdateMany).toHaveBeenCalledWith({
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

describe('createInboundSupportTicket', () => {
  it('creates the inbound ticket for the phone with the matched submission', async () => {
    await createInboundSupportTicket({
      phoneE164: '+15551234567',
      submissionId: 'sub_123',
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTicketCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phoneE164: '+15551234567',
        submissionId: 'sub_123',
      }),
    })
  })
})

describe('recordSupportTicketInbound', () => {
  it('links the matched submission while touching the ticket', async () => {
    await recordSupportTicketInbound('ticket_123', {
      matchedSubmissionId: 'sub_approved',
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: {
        submissionId: 'sub_approved',
        lastInboundAt: new Date('2026-06-29T12:05:00Z'),
        closedAt: null,
      },
    })
  })

  it('only touches the ticket when no submission matched', async () => {
    await recordSupportTicketInbound('ticket_123', {
      matchedSubmissionId: undefined,
      lastInboundAt: new Date('2026-06-29T12:05:00Z'),
    })

    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: {
        lastInboundAt: new Date('2026-06-29T12:05:00Z'),
        closedAt: null,
      },
    })
  })
})

describe('linkSmsMessageToSupportTicket', () => {
  it('links the provider message to the ticket and submission', async () => {
    await linkSmsMessageToSupportTicket('msg_later', {
      supportTicketId: 'ticket_123',
      submissionId: 'sub_approved',
    })

    expect(mockMessageUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_later' },
      data: {
        supportTicketId: 'ticket_123',
        submissionId: 'sub_approved',
      },
    })
  })

  it('clears the submission link when none is known', async () => {
    await linkSmsMessageToSupportTicket('msg_help', {
      supportTicketId: 'ticket_123',
      submissionId: null,
    })

    expect(mockMessageUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'msg_help' },
      data: {
        supportTicketId: 'ticket_123',
        submissionId: null,
      },
    })
  })
})

describe('updateSupportTicketConversation', () => {
  it('writes the conversation update to the ticket', async () => {
    const update = {
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
      collectedData: {
        notePurpose: 'both',
        otherNotePurpose: null,
      },
    }

    await updateSupportTicketConversation('ticket_123', update)

    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: {
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
        collectedData: {
          notePurpose: 'both',
          otherNotePurpose: null,
        },
      },
    })
  })
})

describe('escalateSupportTicketToCsr', () => {
  it('moves the ticket to CSR review with the summary and collected data', async () => {
    await escalateSupportTicketToCsr('ticket_123', {
      category: SMS_SUPPORT_CATEGORY.OTHER,
      adminSummary: 'Customer message: My SSN is 123-45-6789 and diagnosis is flu',
      collectedData: { freeformMessage: 'My SSN is 123-45-6789 and diagnosis is flu' },
    })

    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        adminSummary: 'Customer message: My SSN is 123-45-6789 and diagnosis is flu',
        collectedData: expect.objectContaining({
          freeformMessage: 'My SSN is 123-45-6789 and diagnosis is flu',
        }),
      }),
    })
  })

  it('sets the needs-CSR status and review state', async () => {
    await escalateSupportTicketToCsr('ticket_123', {
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
      adminSummary: 'Customer asked to change note purpose to a legal matter by SMS.',
      collectedData: {},
    })

    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
        adminSummary: 'Customer asked to change note purpose to a legal matter by SMS.',
      }),
    })
  })
})

describe('markSupportTicketReplyFailed', () => {
  it('escalates the ticket to CSR review with the send failure', async () => {
    await markSupportTicketReplyFailed('ticket_123', 'Support SMS send failed: Telnyx timeout')

    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        failureReason: 'Support SMS send failed: Telnyx timeout',
        adminSummary: 'Support SMS failed to send. Admin should contact the customer manually.',
      }),
    })
  })
})

describe('createSupportAutomationJob', () => {
  it('creates a queued support automation job for the ticket', async () => {
    mockJobCreate.mockResolvedValue({ id: 'job_new' })

    const result = await createSupportAutomationJob({
      ticketId: 'ticket_123',
      payload: dobPayload,
    })

    expect(result).toEqual({ id: 'job_new' })
    expect(mockJobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: 'ticket_123',
        kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
        status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      }),
    })
  })

  it('returns null when an active job already holds the unique index', async () => {
    mockJobCreate.mockRejectedValue({ code: 'P2002' })

    const result = await createSupportAutomationJob({
      ticketId: 'ticket_123',
      payload: dobPayload,
    })

    expect(result).toBeNull()
  })

  it('rethrows errors that are not unique-index conflicts', async () => {
    const error = new Error('connection lost')
    mockJobCreate.mockRejectedValue(error)

    await expect(
      createSupportAutomationJob({ ticketId: 'ticket_123', payload: dobPayload })
    ).rejects.toBe(error)
  })
})

describe('findActiveSupportAutomationJob', () => {
  it('finds the newest active automation job for the ticket', async () => {
    mockJobFindFirst.mockResolvedValue({
      id: 'job_active',
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: dobPayload,
    })

    const result = await findActiveSupportAutomationJob('ticket_123')

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
})

describe('requeueStaleRunningSupportJobs', () => {
  it('returns stale running jobs to the queue and clears their lock', async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 1 })

    await requeueStaleRunningSupportJobs(new Date('2026-06-29T12:00:00Z'))

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
  })
})

describe('findRunnableQueuedSupportJobs', () => {
  it('selects queued jobs whose ticket is still running automation', async () => {
    mockJobFindMany.mockResolvedValue([])

    const result = await findRunnableQueuedSupportJobs(1)

    expect(result).toEqual([])
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
})

describe('findRunnableQueuedSupportJob', () => {
  it('finds the queued job only when it is due and its ticket is running automation', async () => {
    mockJobFindFirst.mockResolvedValue({ id: 'job_123', ticketId: 'ticket_123' })

    const result = await findRunnableQueuedSupportJob('job_123')

    expect(result).toEqual({ id: 'job_123', ticketId: 'ticket_123' })
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
  })
})

describe('claimQueuedSupportJob', () => {
  it('locks a queued job for the worker and returns the claimed count', async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 1 })

    const result = await claimQueuedSupportJob('job_123', 'sms-inbound-test')

    expect(result).toBe(1)
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
  })

  it('returns zero when another worker already claimed the job', async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 0 })

    await expect(claimQueuedSupportJob('job_123', 'sms-inbound-test')).resolves.toBe(0)
  })
})

describe('completeSupportJob', () => {
  it('marks the job succeeded and clears its last error', async () => {
    mockJobUpdate.mockResolvedValue({})

    await completeSupportJob('job_123')

    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
        lastError: null,
      }),
    })
  })
})

describe('failSupportJob', () => {
  it('marks the job failed with the error message', async () => {
    mockJobUpdate.mockResolvedValue({})

    await failSupportJob('job_123', 'Resend timeout')

    expect(mockJobUpdate).toHaveBeenCalledWith({
      where: { id: 'job_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_JOB_STATUS.FAILED,
        lastError: 'Resend timeout',
      }),
    })
  })
})

describe('escalateSupportTicketAfterAutomationFailure', () => {
  it('moves the ticket to CSR review with failed automation and returns it', async () => {
    const ticket = {
      id: 'ticket_123',
      phoneE164: '+15551234567',
      category: 'CHANGE_DOB',
      submissionId: 'sub_123',
    }
    mockTicketUpdate.mockResolvedValue(ticket)

    const result = await escalateSupportTicketAfterAutomationFailure('ticket_123', 'Resend timeout')

    expect(result).toBe(ticket)
    expect(mockTicketUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket_123' },
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
        failureReason: 'Resend timeout',
      }),
    })
  })
})

describe('failStaleCommittingSupportJob', () => {
  it('fails a job still committing since before the stale cutoff and returns the claimed count', async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 1 })

    const result = await failStaleCommittingSupportJob('job_finalizing', {
      staleBefore: new Date('2026-06-29T12:15:00Z'),
      lastError:
        'Support automation stalled while finalizing the updated note. Admin must verify whether the note/email was issued before retrying manually.',
    })

    expect(result).toBe(1)
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
  })
})

describe('claimSupportTicketAutomationRun', () => {
  it('claims the ticket for the running automation and returns the claimed count', async () => {
    mockTicketUpdateMany.mockResolvedValue({ count: 1 })

    const result = await claimSupportTicketAutomationRun('ticket_123')

    expect(result).toBe(1)
    expect(mockTicketUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'ticket_123' }),
      data: expect.objectContaining({
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      }),
    })
  })
})
