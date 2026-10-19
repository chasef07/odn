import {
  automationSummary,
  parseAutomationPayload,
  runSupportTicketAutomation,
  SupportAutomationCancelledError,
  SupportAutomationManualReviewError,
  type SupportAutomationPayload,
} from '@/lib/sms-support-automation'
import { SMS_SUPPORT_JOB_STATUS } from '@/lib/sms-support-types'
import { alertSupportTicketNeedsCsr } from '@/lib/sms-support-alerts'
import {
  findActiveSupportAutomationJob,
  findActiveSupportAutomationJobId,
  findLatestSupportAutomationJob,
  findRunnableQueuedSupportJob,
  findRunnableQueuedSupportJobs,
  findStaleCommittingSupportJobs,
} from '@/db/sms-support'
import {
  createSupportAutomationJob,
  permit,
  requeueStaleSupportJobs,
  required,
  startAutomationRetry,
  transition,
  transitionJob,
} from '@/db/sms-support-lifecycle'
import type { JsonObject, JsonValue, SmsSupportTicket } from '@/db/types'

const STALE_RUNNING_JOB_MS = 15 * 60 * 1000
const STALE_COMMITTING_MESSAGE =
  'Support automation stalled while finalizing the updated note. Admin must verify whether the note/email was issued before retrying manually.'

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
  const createdJob = await createSupportAutomationJob({
    ticketId,
    payload,
  })
  if (createdJob) return createdJob

  const existingJob = await findActiveSupportAutomationJob(ticketId)

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
  const job = await findRunnableQueuedSupportJob(jobId)

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
  const now = new Date()
  const staleBefore = new Date(now.getTime() - STALE_RUNNING_JOB_MS)

  await requeueStaleSupportJobs(staleBefore, { at: now })

  let processed = 0
  let succeeded = 0
  let failed = 0

  const staleCommittingJobs = await findStaleCommittingSupportJobs(staleBefore, limit)

  for (const job of staleCommittingJobs) {
    const claimed = await transitionJob('failStale', job.id, {
      at: new Date(),
      lastError: STALE_COMMITTING_MESSAGE,
    })

    if (!claimed.ok) continue

    processed += 1
    failed += 1

    const ticket = await escalateTicket(job.ticketId, STALE_COMMITTING_MESSAGE)

    await alertSupportTicketNeedsCsr({
      ticketId: ticket.id,
      phoneE164: ticket.phoneE164,
      category: ticket.category,
      submissionId: ticket.submissionId,
      summary: STALE_COMMITTING_MESSAGE,
    })
  }

  const jobs = await findRunnableQueuedSupportJobs(limit)

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
  const claimed = await transitionJob('claim', job.id, { at: new Date(), workerId })

  if (!claimed.ok) return { processed: 0, succeeded: 0, failed: 0 }

  try {
    await runSupportTicketAutomation(job.id)
    required(
      await transitionJob('complete', job.id, { at: new Date() }),
      `complete of support job ${job.id}`
    )
    return { processed: 1, succeeded: 1, failed: 0 }
  } catch (error) {
    await handleSupportJobFailure(job, error)
    return { processed: 1, succeeded: 0, failed: 1 }
  }
}

async function failJob(jobId: string, lastError: string): Promise<void> {
  required(
    await transitionJob('fail', jobId, { at: new Date(), lastError }),
    `fail of support job ${jobId}`
  )
}

async function escalateTicket(ticketId: string, failureReason: string): Promise<SmsSupportTicket> {
  return required(
    await transition('automationFailed', ticketId, { at: new Date(), failureReason }),
    `automationFailed of support ticket ${ticketId}`
  )
}

async function handleSupportJobFailure(job: QueuedSupportJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown support job error'

  if (error instanceof SupportAutomationCancelledError) {
    await failJob(job.id, message)
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
  const permitted = await permit(ticketId, 'retryAutomation')

  if (!permitted.ok) {
    return permitted.refusal.reason === 'missing'
      ? { success: false, error: 'Support ticket not found' }
      : { success: false, error: 'Ticket is not in failed automation state' }
  }

  const activeJob = await findActiveSupportAutomationJobId(ticketId)

  if (activeJob) return { success: true }

  const latestJob = await findLatestSupportAutomationJob(ticketId)

  if (!latestJob || latestJob.status !== SMS_SUPPORT_JOB_STATUS.FAILED) {
    return { success: false, error: 'No failed automation job to retry' }
  }

  const payload = latestJob.payload as JsonObject | null
  const retried = await startAutomationRetry(ticketId, {
    at: new Date(),
    summary:
      payload && typeof payload === 'object'
        ? automationSummary(payload as unknown as SupportAutomationPayload)
        : null,
    payload: latestJob.payload,
  })

  if (!retried.ok) return { success: false, error: 'Ticket is not in failed automation state' }

  await processSmsSupportJobNow(retried.value.job.id, { workerId: `admin-retry-${Date.now()}` })

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
  await failJob(jobId, message)

  const ticket = await escalateTicket(ticketId, message)

  await alertSupportTicketNeedsCsr({
    ticketId: ticket.id,
    phoneE164: ticket.phoneE164,
    category: ticket.category,
    submissionId: ticket.submissionId,
    summary,
  })
}

function automationPayloadsMatch(
  existingPayload: JsonValue | null,
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
