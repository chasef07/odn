'use server'

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { revalidateSupportPaths } from './shared'
import { adminAction } from '@/lib/admin-session'

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

export const getSupportTickets = adminAction(async (_admin, status?: string) => {
  const tickets = status
    ? await prisma.smsSupportTicket.findMany({
        where: { status },
        include: supportTicketListInclude,
        orderBy: { updatedAt: 'desc' },
        take: 200,
      })
    : await getDefaultSupportTicketQueue()

  return { success: true, tickets: tickets as SupportTicketListItem[] }
})

export const getSupportTicket = adminAction(async (_admin, ticketId: string) => {
  const ticket = await prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    include: supportTicketDetailInclude,
  })

  return { success: true, ticket: ticket as SupportTicketDetail | null }
})

export const createSupportTicketFromSubmission = adminAction(
  async (_admin, submissionId: string) => {
    try {
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
)

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
