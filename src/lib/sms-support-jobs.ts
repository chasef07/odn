import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  automationSummary,
  parseAutomationPayload,
  runSupportTicketAutomation,
  SupportAutomationCancelledError,
  SupportAutomationManualReviewError,
  type SupportAutomationPayload,
} from '@/lib/sms-support-automation'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { alertSupportTicketNeedsCsr } from '@/lib/sms-support-alerts'
import { isUniqueConstraintError } from '@/lib/prisma-errors'

const STALE_RUNNING_JOB_MS = 15 * 60 * 1000
const STALE_COMMITTING_MESSAGE =
  'Support automation stalled while finalizing the updated note. Admin must verify whether the note/email was issued before retrying manually.'
const ACTIVE_JOB_STATUSES = [
  SMS_SUPPORT_JOB_STATUS.QUEUED,
  SMS_SUPPORT_JOB_STATUS.RUNNING,
  SMS_SUPPORT_JOB_STATUS.COMMITTING,
]

export class SupportAutomationPayloadConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupportAutomationPayloadConflictError'
  }
}

export async function enqueueSupportAutomationJob({
  ticketId,
  payload,
}: {
  ticketId: string
  payload: SupportAutomationPayload
}) {
  try {
    return await prisma.smsSupportJob.create({
      data: {
        ticketId,
        kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
        status: SMS_SUPPORT_JOB_STATUS.QUEUED,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
  }

  const existingJob = await prisma.smsSupportJob.findFirst({
    where: {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!existingJob) throw new Error('Active support automation job already exists')
  if (!automationPayloadsMatch(existingJob.payload, payload)) {
    throw new SupportAutomationPayloadConflictError(
      'A different support automation job is already active for this ticket'
    )
  }
  return existingJob
}

type JobProcessingResult = { processed: number; succeeded: number; failed: number }
type QueuedSupportJob = { id: string; ticketId: string }

export async function processSmsSupportJobNow(
  jobId: string,
  { workerId = `sms-support-immediate-${process.pid}` }: { workerId?: string } = {}
): Promise<JobProcessingResult> {
  const job = await prisma.smsSupportJob.findFirst({
    where: {
      id: jobId,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      runAfter: { lte: new Date() },
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

  if (!job) return { processed: 0, succeeded: 0, failed: 0 }

  return processQueuedSupportJob(job, workerId)
}

export async function processQueuedSmsSupportJobs({
  limit = 5,
  workerId = `sms-support-${process.pid}`,
}: {
  limit?: number
  workerId?: string
} = {}): Promise<{ processed: number; succeeded: number; failed: number }> {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_JOB_MS)

  await prisma.smsSupportJob.updateMany({
    where: {
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: { lt: staleBefore },
    },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      lockedAt: null,
      lockedBy: null,
      lastError: 'Recovered stale running job lock',
      runAfter: new Date(),
    },
  })

  let processed = 0
  let succeeded = 0
  let failed = 0

  const staleCommittingJobs = await prisma.smsSupportJob.findMany({
    where: {
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      lockedAt: { lt: staleBefore },
    },
    include: { ticket: true },
    take: limit,
  })

  for (const job of staleCommittingJobs) {
    const claimed = await prisma.smsSupportJob.updateMany({
      where: {
        id: job.id,
        status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
        lockedAt: { lt: staleBefore },
      },
      data: {
        status: SMS_SUPPORT_JOB_STATUS.FAILED,
        lockedAt: null,
        lockedBy: null,
        lastError: STALE_COMMITTING_MESSAGE,
        completedAt: new Date(),
      },
    })

    if (claimed.count !== 1) continue

    processed += 1
    failed += 1

    const ticket = await prisma.smsSupportTicket.update({
      where: { id: job.ticketId },
      data: {
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: 'CSR_REVIEW',
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
        failureReason: STALE_COMMITTING_MESSAGE,
      },
    })

    await alertSupportTicketNeedsCsr({
      ticketId: ticket.id,
      phoneE164: ticket.phoneE164,
      category: ticket.category,
      submissionId: ticket.submissionId,
      summary: STALE_COMMITTING_MESSAGE,
    })
  }

  const jobs = await prisma.smsSupportJob.findMany({
    where: {
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      runAfter: { lte: new Date() },
      ticket: {
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        automationStatus: {
          in: [SMS_SUPPORT_AUTOMATION_STATUS.QUEUED, SMS_SUPPORT_AUTOMATION_STATUS.RUNNING],
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  for (const job of jobs) {
    const result = await processQueuedSupportJob(job, workerId)
    processed += result.processed
    succeeded += result.succeeded
    failed += result.failed
  }

  return { processed, succeeded, failed }
}

async function processQueuedSupportJob(
  job: QueuedSupportJob,
  workerId: string
): Promise<JobProcessingResult> {
  const claimed = await prisma.smsSupportJob.updateMany({
    where: {
      id: job.id,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
    },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: { increment: 1 },
    },
  })

  if (claimed.count !== 1) return { processed: 0, succeeded: 0, failed: 0 }

  try {
    await runSupportTicketAutomation(job.id)
    await prisma.smsSupportJob.update({
      where: { id: job.id },
      data: {
        status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    })
    return { processed: 1, succeeded: 1, failed: 0 }
  } catch (error) {
    await handleSupportJobFailure(job, error)
    return { processed: 1, succeeded: 0, failed: 1 }
  }
}

async function handleSupportJobFailure(job: QueuedSupportJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown support job error'

  if (error instanceof SupportAutomationCancelledError) {
    await prisma.smsSupportJob.update({
      where: { id: job.id },
      data: {
        status: SMS_SUPPORT_JOB_STATUS.FAILED,
        lockedAt: null,
        lockedBy: null,
        lastError: message,
        completedAt: new Date(),
      },
    })
    return
  }

  await failJobAndEscalateToCsr({
    jobId: job.id,
    ticketId: job.ticketId,
    message,
    summary:
      error instanceof SupportAutomationManualReviewError
        ? `Automation requires admin review: ${message}`
        : `Automation failed and needs admin review: ${message}`,
  })
}

export async function retrySupportAutomationJob(ticketId: string) {
  const ticket = await prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      automationKind: true,
      automationStatus: true,
      collectedData: true,
      status: true,
    },
  })

  if (!ticket) return { success: false, error: 'Support ticket not found' }
  if (
    ticket.status !== SMS_SUPPORT_STATUS.NEEDS_CSR ||
    ticket.automationStatus !== SMS_SUPPORT_AUTOMATION_STATUS.FAILED
  ) {
    return { success: false, error: 'Ticket is not in failed automation state' }
  }

  const activeJob = await prisma.smsSupportJob.findFirst({
    where: {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    select: { id: true },
  })

  if (activeJob) return { success: true }

  const latestJob = await prisma.smsSupportJob.findFirst({
    where: {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!latestJob || latestJob.status !== SMS_SUPPORT_JOB_STATUS.FAILED) {
    return { success: false, error: 'No failed automation job to retry' }
  }

  const job = await prisma.smsSupportJob.create({
    data: {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: latestJob.payload as Prisma.InputJsonValue,
    },
  })

  const payload = latestJob.payload as Prisma.JsonObject | null
  await prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
      adminSummary:
        payload && typeof payload === 'object'
          ? `Retry started: ${automationSummary(payload as unknown as SupportAutomationPayload)}`
          : 'Retry started.',
      failureReason: null,
      retryCount: { increment: 1 },
    },
  })

  await processSmsSupportJobNow(job.id, { workerId: `admin-retry-${Date.now()}` })

  return { success: true }
}

async function failJobAndEscalateToCsr({
  jobId,
  ticketId,
  message,
  summary,
}: {
  jobId: string
  ticketId: string
  message: string
  summary: string
}) {
  await prisma.smsSupportJob.update({
    where: { id: jobId },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError: message,
      completedAt: new Date(),
    },
  })

  const ticket = await prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: 'CSR_REVIEW',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
      failureReason: message,
    },
  })

  await alertSupportTicketNeedsCsr({
    ticketId: ticket.id,
    phoneE164: ticket.phoneE164,
    category: ticket.category,
    submissionId: ticket.submissionId,
    summary,
  })
}

function automationPayloadsMatch(
  existingPayload: Prisma.JsonValue | null,
  nextPayload: SupportAutomationPayload
): boolean {
  const existing = parseAutomationPayload(existingPayload)
  if (!existing) return false

  return (
    existing.kind === nextPayload.kind &&
    existing.category === nextPayload.category &&
    updateValue(existing.updates.patientDateOfBirth) ===
      updateValue(nextPayload.updates.patientDateOfBirth) &&
    updateValue(existing.updates.notePurpose) === updateValue(nextPayload.updates.notePurpose) &&
    updateValue(existing.updates.otherNotePurpose) ===
      updateValue(nextPayload.updates.otherNotePurpose)
  )
}

function updateValue(value: string | null | undefined): string | null {
  return value ?? null
}
