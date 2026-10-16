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
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { alertSupportTicketNeedsCsr } from '@/lib/sms-support-alerts'
import {
  claimQueuedSupportJob,
  completeSupportJob,
  createRetrySupportAutomationJob,
  createSupportAutomationJob,
  escalateSupportTicketAfterAutomationFailure,
  failStaleCommittingSupportJob,
  failSupportJob,
  findActiveSupportAutomationJob,
  findActiveSupportAutomationJobId,
  findLatestSupportAutomationJob,
  findRunnableQueuedSupportJob,
  findRunnableQueuedSupportJobs,
  findStaleCommittingSupportJobs,
  findSupportTicketForAutomationRetry,
  requeueStaleRunningSupportJobs,
  startSupportAutomationRetry,
} from '@/db/sms-support'
import type { JsonObject, JsonValue } from '@/db/types'

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
  const staleBefore = new Date(Date.now() - STALE_RUNNING_JOB_MS)

  await requeueStaleRunningSupportJobs(staleBefore)

  let processed = 0
  let succeeded = 0
  let failed = 0

  const staleCommittingJobs = await findStaleCommittingSupportJobs(staleBefore, limit)

  for (const job of staleCommittingJobs) {
    const claimed = await failStaleCommittingSupportJob(job.id, {
      staleBefore,
      lastError: STALE_COMMITTING_MESSAGE,
    })

    if (claimed !== 1) continue

    processed += 1
    failed += 1

    const ticket = await escalateSupportTicketAfterAutomationFailure(
      job.ticketId,
      STALE_COMMITTING_MESSAGE
    )

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
  const claimed = await claimQueuedSupportJob(job.id, workerId)

  if (claimed !== 1) return { processed: 0, succeeded: 0, failed: 0 }

  try {
    await runSupportTicketAutomation(job.id)
    await completeSupportJob(job.id)
    return { processed: 1, succeeded: 1, failed: 0 }
  } catch (error) {
    await handleSupportJobFailure(job, error)
    return { processed: 1, succeeded: 0, failed: 1 }
  }
}

async function handleSupportJobFailure(job: QueuedSupportJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown support job error'

  if (error instanceof SupportAutomationCancelledError) {
    await failSupportJob(job.id, message)
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
  const ticket = await findSupportTicketForAutomationRetry(ticketId)

  if (!ticket) return { success: false, error: 'Support ticket not found' }
  if (
    ticket.status !== SMS_SUPPORT_STATUS.NEEDS_CSR ||
    ticket.automationStatus !== SMS_SUPPORT_AUTOMATION_STATUS.FAILED
  ) {
    return { success: false, error: 'Ticket is not in failed automation state' }
  }

  const activeJob = await findActiveSupportAutomationJobId(ticketId)

  if (activeJob) return { success: true }

  const latestJob = await findLatestSupportAutomationJob(ticketId)

  if (!latestJob || latestJob.status !== SMS_SUPPORT_JOB_STATUS.FAILED) {
    return { success: false, error: 'No failed automation job to retry' }
  }

  const job = await createRetrySupportAutomationJob({ ticketId, payload: latestJob.payload })

  const payload = latestJob.payload as JsonObject | null
  await startSupportAutomationRetry(
    ticketId,
    payload && typeof payload === 'object'
      ? automationSummary(payload as unknown as SupportAutomationPayload)
      : null
  )

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
  await failSupportJob(jobId, message)

  const ticket = await escalateSupportTicketAfterAutomationFailure(ticketId, message)

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
