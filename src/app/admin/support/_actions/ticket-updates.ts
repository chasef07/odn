'use server'

import { sendSupportSms } from '@/lib/sms-support-sms'
import { retrySupportAutomationJob } from '@/lib/sms-support-jobs'
import { findCommittingSupportJob } from '@/db/sms-support'
import { cancelSupportJobs, transition, type TicketRefusal } from '@/db/sms-support-lifecycle'
import { revalidateSupportPaths } from './shared'
import { adminAction } from '@/lib/admin-session'

type Failed = { success: false; error: string }

function refused(refusal: TicketRefusal): Failed {
  return {
    success: false,
    error:
      refusal.reason === 'missing'
        ? 'Support ticket not found'
        : 'Support ticket was already updated. Please refresh and try again.',
  }
}

export const sendSupportTicketReply = adminAction(
  async (_admin, ticketId: string, body: string) => {
    try {
      const message = body.trim()
      if (!message) return { success: false, error: 'Message is required' }
      if (message.length > 1000) return { success: false, error: 'Message is too long' }

      const now = new Date()

      const cancelResult = await cancelCancellableSupportJobs({
        ticketId,
        now,
        lastError: 'Ticket replied to by admin before automation completed',
      })
      if (!cancelResult.success) return cancelResult

      const replied = await transition('adminReplied', ticketId, { at: now })
      if (!replied.ok) return refused(replied.refusal)
      const ticket = replied.value

      const result = await sendSupportSms({
        ticketId: ticket.id,
        submissionId: ticket.submissionId,
        toPhone: ticket.phoneE164,
        type: 'SUPPORT_REPLY',
        body: message,
      })

      if (!result.success) {
        const errorMessage = result.error || 'Failed to send SMS'
        await transition('adminReplyFailed', ticketId, {
          at: new Date(),
          failureReason: `Admin SMS reply failed: ${errorMessage}`,
        })
        revalidateSupportPaths(ticketId, ticket.submissionId)
        return { success: false, error: errorMessage }
      }

      revalidateSupportPaths(ticketId, ticket.submissionId)
      return { success: true }
    } catch (error) {
      console.error('Failed to send support SMS reply:', error)
      return { success: false, error: 'Failed to send support SMS reply' }
    }
  }
)

export const closeSupportTicket = adminAction(async (_admin, ticketId: string) => {
  try {
    return await takeOver(ticketId, 'closeByAdmin', 'Ticket closed by admin before automation ran')
  } catch (error) {
    console.error('Failed to close support ticket:', error)
    return { success: false, error: 'Failed to close support ticket' }
  }
})

export const markSupportTicketNeedsCsr = adminAction(async (_admin, ticketId: string) => {
  try {
    return await takeOver(
      ticketId,
      'returnToCsr',
      'Ticket escalated to admin before automation ran'
    )
  } catch (error) {
    console.error('Failed to mark support ticket for admin review:', error)
    return { success: false, error: 'Failed to mark support ticket for admin review' }
  }
})

export const retrySupportTicketAutomation = adminAction(async (_admin, ticketId: string) => {
  try {
    const result = await retrySupportAutomationJob(ticketId)
    if (!result.success) return result

    revalidateSupportPaths(ticketId)
    return { success: true }
  } catch (error) {
    console.error('Failed to retry support automation:', error)
    return { success: false, error: 'Failed to retry support automation' }
  }
})

async function takeOver(
  ticketId: string,
  name: 'closeByAdmin' | 'returnToCsr',
  lastError: string
): Promise<{ success: true } | Failed> {
  const now = new Date()
  const cancelResult = await cancelCancellableSupportJobs({ ticketId, now, lastError })
  if (!cancelResult.success) return cancelResult

  const moved = await transition(name, ticketId, { at: now })
  if (!moved.ok) return refused(moved.refusal)

  revalidateSupportPaths(ticketId, moved.value.submissionId)
  return { success: true }
}

async function cancelCancellableSupportJobs({
  ticketId,
  now,
  lastError,
}: {
  ticketId: string
  now: Date
  lastError: string
}): Promise<{ success: true } | Failed> {
  await cancelSupportJobs(ticketId, { at: now, lastError })

  const finalizingJob = await findCommittingSupportJob(ticketId)

  if (finalizingJob) {
    return {
      success: false,
      error: 'Automation is finalizing the updated note. Refresh in a moment before taking over.',
    }
  }

  return { success: true }
}
