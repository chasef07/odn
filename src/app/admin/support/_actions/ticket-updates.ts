'use server'

import { sendSupportSms } from '@/lib/sms-support-sms'
import { retrySupportAutomationJob } from '@/lib/sms-support-jobs'
import {
  closeSupportTicketByAdmin,
  failQueuedOrRunningSupportJobs,
  findCommittingSupportJob,
  findSupportTicketContact,
  markSupportTicketAdminReplied,
  markSupportTicketAdminReplyFailed,
  returnSupportTicketToCsrReview,
} from '@/db/sms-support'
import { revalidateSupportPaths } from './shared'
import { adminAction } from '@/lib/admin-session'

export const sendSupportTicketReply = adminAction(
  async (_admin, ticketId: string, body: string) => {
    try {
      const message = body.trim()
      if (!message) return { success: false, error: 'Message is required' }
      if (message.length > 1000) return { success: false, error: 'Message is too long' }

      const ticket = await findSupportTicketContact(ticketId)

      if (!ticket) return { success: false, error: 'Support ticket not found' }

      const now = new Date()

      const cancelResult = await cancelCancellableSupportJobs({
        ticketId,
        now,
        lastError: 'Ticket replied to by admin before automation completed',
      })
      if (!cancelResult.success) return cancelResult

      await markSupportTicketAdminReplied(ticketId)

      const result = await sendSupportSms({
        ticketId: ticket.id,
        submissionId: ticket.submissionId,
        toPhone: ticket.phoneE164,
        type: 'SUPPORT_REPLY',
        body: message,
      })

      if (!result.success) {
        const errorMessage = result.error || 'Failed to send SMS'
        await markSupportTicketAdminReplyFailed(ticketId, `Admin SMS reply failed: ${errorMessage}`)
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
    const now = new Date()
    const cancelResult = await cancelCancellableSupportJobs({
      ticketId,
      now,
      lastError: 'Ticket closed by admin before automation ran',
    })
    if (!cancelResult.success) return cancelResult

    const ticket = await closeSupportTicketByAdmin(ticketId, now)

    revalidateSupportPaths(ticketId, ticket.submissionId)
    return { success: true }
  } catch (error) {
    console.error('Failed to close support ticket:', error)
    return { success: false, error: 'Failed to close support ticket' }
  }
})

export const markSupportTicketNeedsCsr = adminAction(async (_admin, ticketId: string) => {
  try {
    const cancelResult = await cancelCancellableSupportJobs({
      ticketId,
      now: new Date(),
      lastError: 'Ticket escalated to admin before automation ran',
    })
    if (!cancelResult.success) return cancelResult

    const ticket = await returnSupportTicketToCsrReview(ticketId)

    revalidateSupportPaths(ticketId, ticket.submissionId)
    return { success: true }
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

async function cancelCancellableSupportJobs({
  ticketId,
  now,
  lastError,
}: {
  ticketId: string
  now: Date
  lastError: string
}): Promise<{ success: true } | { success: false; error: string }> {
  await failQueuedOrRunningSupportJobs(ticketId, { lastError, completedAt: now })

  const finalizingJob = await findCommittingSupportJob(ticketId)

  if (finalizingJob) {
    return {
      success: false,
      error: 'Automation is finalizing the updated note. Refresh in a moment before taking over.',
    }
  }

  return { success: true }
}
