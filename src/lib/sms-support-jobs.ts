import {
  automationSummary,
  runSupportTicketAutomation,
  SupportAutomationCancelledError,
  SupportAutomationManualReviewError,
  type SupportAutomationPayload,
} from '@/lib/sms-support-automation'
import { SMS_SUPPORT_JOB_STATUS } from '@/lib/sms-support-types'
import { alertSupportTicketNeedsCsr } from '@/lib/sms-support-alerts'
import {
  findActiveSupportAutomationJobId,
  findLatestSupportAutomationJob,
  findRunnableQueuedSupportJob,
} from '@/db/sms-support'
import {
  permit,
  required,
  startAutomationRetry,
  transition,
  transitionJob,
} from '@/db/sms-support-lifecycle'
import type { JsonObject, SmsSupportTicket } from '@/db/types'

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
