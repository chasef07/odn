'use server'

import prisma from '@/lib/prisma'
import { sendSupportSms } from '@/lib/sms-support-sms'
import { retrySupportAutomationJob } from '@/lib/sms-support-jobs'
import {
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { revalidateSupportPaths } from './shared'
import { adminAction } from '@/lib/admin-session'

export const sendSupportTicketReply = adminAction(
  async (_admin, ticketId: string, body: string) => {
    try {
      const message = body.trim()
      if (!message) return { success: false, error: 'Message is required' }
      if (message.length > 1000) return { success: false, error: 'Message is too long' }

      const ticket = await prisma.smsSupportTicket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          phoneE164: true,
          submissionId: true,
        },
      })

      if (!ticket) return { success: false, error: 'Support ticket not found' }

      const now = new Date()

      const cancelResult = await cancelCancellableSupportJobs({
        ticketId,
        now,
        lastError: 'Ticket replied to by admin before automation completed',
      })
      if (!cancelResult.success) return cancelResult

      await prisma.smsSupportTicket.update({
        where: { id: ticketId },
        data: {
          status: SMS_SUPPORT_STATUS.OPEN,
          state: SMS_SUPPORT_STATE.CSR_REVIEW,
          adminSummary: 'Admin replied by SMS.',
          csrAlertedAt: null,
        },
      })

      const result = await sendSupportSms({
        ticketId: ticket.id,
        submissionId: ticket.submissionId,
        toPhone: ticket.phoneE164,
        type: 'SUPPORT_REPLY',
        body: message,
      })

      if (!result.success) {
        const errorMessage = result.error || 'Failed to send SMS'
        await prisma.smsSupportTicket.update({
          where: { id: ticketId },
          data: {
            status: SMS_SUPPORT_STATUS.NEEDS_CSR,
            state: SMS_SUPPORT_STATE.CSR_REVIEW,
            adminSummary: 'Admin reply failed to send by SMS.',
            failureReason: `Admin SMS reply failed: ${errorMessage}`,
          },
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
    const now = new Date()
    const cancelResult = await cancelCancellableSupportJobs({
      ticketId,
      now,
      lastError: 'Ticket closed by admin before automation ran',
    })
    if (!cancelResult.success) return cancelResult

    const ticket = await prisma.smsSupportTicket.update({
      where: { id: ticketId },
      data: {
        status: SMS_SUPPORT_STATUS.CLOSED,
        state: SMS_SUPPORT_STATE.CLOSED,
        closedAt: now,
      },
      select: { submissionId: true },
    })

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

    const ticket = await prisma.smsSupportTicket.update({
      where: { id: ticketId },
      data: {
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        closedAt: null,
      },
      select: { submissionId: true },
    })

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
  await prisma.smsSupportJob.updateMany({
    where: {
      ticketId,
      status: { in: [SMS_SUPPORT_JOB_STATUS.QUEUED, SMS_SUPPORT_JOB_STATUS.RUNNING] },
    },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError,
      completedAt: now,
    },
  })

  const finalizingJob = await prisma.smsSupportJob.findFirst({
    where: {
      ticketId,
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
    },
    select: { id: true },
  })

  if (finalizingJob) {
    return {
      success: false,
      error: 'Automation is finalizing the updated note. Refresh in a moment before taking over.',
    }
  }

  return { success: true }
}
