'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendSupportSms } from '@/lib/sms-support-sms'
import { retrySupportAutomationJob } from '@/lib/sms-support-jobs'
import {
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'

const ACTIVE_TICKET_STATUSES = [
  SMS_SUPPORT_STATUS.OPEN,
  SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
  SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
  SMS_SUPPORT_STATUS.NEEDS_CSR,
]

const supportTicketListInclude = {
  submission: {
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      email: true,
      status: true,
      notePurpose: true,
      firstDayOff: true,
      lastDayOff: true,
    },
  },
  messages: {
    select: {
      id: true,
      direction: true,
      body: true,
      providerStatus: true,
      createdAt: true,
      receivedAt: true,
      sentAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  jobs: {
    select: {
      id: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.SmsSupportTicketInclude

const supportTicketDetailInclude = {
  submission: {
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      patientDateOfBirth: true,
      email: true,
      phone: true,
      status: true,
      notePurpose: true,
      otherNotePurpose: true,
      firstDayOff: true,
      lastDayOff: true,
      approvalEmailSentAt: true,
      updatedAt: true,
    },
  },
  messages: {
    select: {
      id: true,
      type: true,
      direction: true,
      to: true,
      from: true,
      body: true,
      providerStatus: true,
      errorCode: true,
      errorMessage: true,
      sentAt: true,
      receivedAt: true,
      finalizedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  jobs: {
    select: {
      id: true,
      kind: true,
      status: true,
      attempts: true,
      lastError: true,
      runAfter: true,
      lockedAt: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.SmsSupportTicketInclude

export type SupportTicketListItem = Prisma.SmsSupportTicketGetPayload<{
  include: typeof supportTicketListInclude
}>
export type SupportTicketDetail = Prisma.SmsSupportTicketGetPayload<{
  include: typeof supportTicketDetailInclude
}>

async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  return session.user
}

export async function getSupportTickets(status?: string) {
  await requireAdmin()

  const tickets = status
    ? await prisma.smsSupportTicket.findMany({
        where: { status },
        include: supportTicketListInclude,
        orderBy: { updatedAt: 'desc' },
        take: 200,
      })
    : await getDefaultSupportTicketQueue()

  return { success: true, tickets: tickets as SupportTicketListItem[] }
}

export async function getSupportTicket(ticketId: string) {
  await requireAdmin()

  const ticket = await prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    include: supportTicketDetailInclude,
  })

  return { success: true, ticket: ticket as SupportTicketDetail | null }
}

export async function createSupportTicketFromSubmission(submissionId: string) {
  try {
    await requireAdmin()

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        smsOptIn: true,
        smsPhoneE164: true,
        patientFirstName: true,
        patientLastName: true,
      },
    })

    if (!submission) return { success: false, error: 'Submission not found' }

    if (!submission.smsOptIn || !submission.smsPhoneE164) {
      return {
        success: false,
        error: 'Submission has no SMS support consent. Customer must text HELP or opt in first.',
      }
    }

    const phoneE164 = submission.smsPhoneE164
    const phoneState = await prisma.smsPhoneState.findUnique({
      where: { phoneE164 },
      select: { optedOutAt: true },
    })

    if (phoneState?.optedOutAt) {
      return {
        success: false,
        error: 'Phone number is opted out of SMS. Customer must text START before SMS support.',
      }
    }

    const existingTicket = await prisma.smsSupportTicket.findFirst({
      where: {
        phoneE164,
        status: { in: ACTIVE_TICKET_STATUSES },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, status: true, submissionId: true },
    })

    if (existingTicket) {
      if (
        existingTicket.status !== SMS_SUPPORT_STATUS.RUNNING_AUTOMATION &&
        existingTicket.submissionId !== submissionId
      ) {
        await prisma.smsSupportTicket.update({
          where: { id: existingTicket.id },
          data: { submissionId },
        })
        revalidateSupportPaths(existingTicket.id, existingTicket.submissionId)
      }

      revalidateSupportPaths(existingTicket.id, submissionId)
      return { success: true, ticketId: existingTicket.id }
    }

    const ticket = await prisma.smsSupportTicket.create({
      data: {
        phoneE164,
        submissionId,
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        category: SMS_SUPPORT_CATEGORY.OTHER,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        source: SMS_SUPPORT_SOURCE.ADMIN_CREATED,
        adminSummary: `Admin opened support ticket for ${submission.patientFirstName} ${submission.patientLastName}.`,
      },
      select: { id: true },
    })

    revalidateSupportPaths(ticket.id, submissionId)

    return { success: true, ticketId: ticket.id }
  } catch (error) {
    console.error('Failed to create support ticket:', error)
    return { success: false, error: 'Failed to create support ticket' }
  }
}

export async function sendSupportTicketReply(ticketId: string, body: string) {
  try {
    await requireAdmin()

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

export async function closeSupportTicket(ticketId: string) {
  try {
    await requireAdmin()

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
}

export async function markSupportTicketNeedsCsr(ticketId: string) {
  try {
    await requireAdmin()

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
}

export async function retrySupportTicketAutomation(ticketId: string) {
  try {
    await requireAdmin()
    const result = await retrySupportAutomationJob(ticketId)
    if (!result.success) return result

    revalidateSupportPaths(ticketId)
    return { success: true }
  } catch (error) {
    console.error('Failed to retry support automation:', error)
    return { success: false, error: 'Failed to retry support automation' }
  }
}

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

function revalidateSupportPaths(ticketId?: string | null, submissionId?: string | null) {
  revalidatePath('/admin')
  revalidatePath('/admin/support')
  if (ticketId) revalidatePath(`/admin/support/${ticketId}`)
  if (submissionId) {
    revalidatePath('/admin/search')
    revalidatePath(`/admin/search/${submissionId}`)
  }
}

async function getDefaultSupportTicketQueue() {
  const activeTickets = await prisma.smsSupportTicket.findMany({
    where: { status: { in: ACTIVE_TICKET_STATUSES } },
    include: supportTicketListInclude,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })

  const remaining = 200 - activeTickets.length
  if (remaining <= 0) return activeTickets

  const closedTickets = await prisma.smsSupportTicket.findMany({
    where: { status: SMS_SUPPORT_STATUS.CLOSED },
    include: supportTicketListInclude,
    orderBy: { updatedAt: 'desc' },
    take: remaining,
  })

  return [...activeTickets, ...closedTickets]
}
