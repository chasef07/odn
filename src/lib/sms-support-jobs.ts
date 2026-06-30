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

const MAX_JOB_ATTEMPTS = 3
const STALE_RUNNING_JOB_MS = 15 * 60 * 1000
const STALE_COMMITTING_MESSAGE =
  'Support automation stalled while finalizing the updated note. Staff must verify whether the note/email was issued before retrying manually.'
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

    if (claimed.count !== 1) continue

    processed += 1

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
      succeeded += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown support job error'
      const nextAttemptCount = job.attempts + 1

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
        failed += 1
        continue
      }

      if (error instanceof SupportAutomationManualReviewError) {
        await failJobAndEscalateToCsr({
          jobId: job.id,
          ticketId: job.ticketId,
          message,
          summary: `Automation requires staff review: ${message}`,
        })
        failed += 1
        continue
      }

      if (nextAttemptCount < MAX_JOB_ATTEMPTS) {
        await prisma.smsSupportJob.update({
          where: { id: job.id },
          data: {
            status: SMS_SUPPORT_JOB_STATUS.QUEUED,
            lockedAt: null,
            lockedBy: null,
            lastError: message,
            runAfter: new Date(Date.now() + nextAttemptCount * 5 * 60 * 1000),
          },
        })
        await prisma.smsSupportTicket.update({
          where: { id: job.ticketId },
          data: {
            status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
            automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
            failureReason: message,
          },
        })
      } else {
        await failJobAndEscalateToCsr({
          jobId: job.id,
          ticketId: job.ticketId,
          message,
          summary: `Automation failed after ${MAX_JOB_ATTEMPTS} attempts: ${message}`,
        })
      }

      failed += 1
    }
  }

  return { processed, succeeded, failed }
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

  await prisma.smsSupportJob.create({
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
          ? `Retry queued: ${automationSummary(payload as unknown as SupportAutomationPayload)}`
          : 'Retry queued.',
      failureReason: null,
      retryCount: { increment: 1 },
    },
  })

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

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
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
    updateValue(existing.updates.firstDayOff) === updateValue(nextPayload.updates.firstDayOff) &&
    updateValue(existing.updates.lastDayOff) === updateValue(nextPayload.updates.lastDayOff) &&
    updateValue(existing.updates.notePurpose) === updateValue(nextPayload.updates.notePurpose) &&
    updateValue(existing.updates.otherNotePurpose) ===
      updateValue(nextPayload.updates.otherNotePurpose)
  )
}

function updateValue(value: string | null | undefined): string | null {
  return value ?? null
}
