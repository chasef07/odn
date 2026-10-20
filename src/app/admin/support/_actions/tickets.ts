'use server'

import { SMS_SUPPORT_STATUS } from '@/lib/sms-support-types'
import { findSubmissionForSupportTicket } from '@/db/submissions'
import { createAdminSupportTicket } from '@/db/sms-support-lifecycle'
import {
  assignSupportTicketSubmission,
  findActiveSupportTicketsForQueue,
  findActiveSupportTicketSummaryForPhone,
  findClosedSupportTicketsForQueue,
  findSmsPhoneOptOut,
  findSupportTicketDetail,
  findSupportTicketsWithStatus,
} from '@/db/sms-support'
import { revalidateSupportPaths } from './shared'
import { adminAction } from '@/lib/admin-session'

export const getSupportTickets = adminAction(async (_admin, status?: string) => {
  const tickets = status
    ? await findSupportTicketsWithStatus(status)
    : await getDefaultSupportTicketQueue()

  return { success: true, tickets }
})

export const getSupportTicket = adminAction(async (_admin, ticketId: string) => {
  const ticket = await findSupportTicketDetail(ticketId)

  return { success: true, ticket }
})

export const createSupportTicketFromSubmission = adminAction(
  async (_admin, submissionId: string) => {
    try {
      const submission = await findSubmissionForSupportTicket(submissionId)

      if (!submission) return { success: false, error: 'Submission not found' }

      if (!submission.smsOptIn || !submission.smsPhoneE164) {
        return {
          success: false,
          error: 'Submission has no SMS support consent. Customer must text HELP or opt in first.',
        }
      }

      const phoneE164 = submission.smsPhoneE164
      const phoneState = await findSmsPhoneOptOut(phoneE164)

      if (phoneState?.optedOutAt) {
        return {
          success: false,
          error: 'Phone number is opted out of SMS. Customer must text START before SMS support.',
        }
      }

      const existingTicket = await findActiveSupportTicketSummaryForPhone(phoneE164)

      if (existingTicket) {
        if (
          existingTicket.status !== SMS_SUPPORT_STATUS.RUNNING_AUTOMATION &&
          existingTicket.submissionId !== submissionId
        ) {
          await assignSupportTicketSubmission(existingTicket.id, submissionId)
          revalidateSupportPaths(existingTicket.id, existingTicket.submissionId)
        }

        revalidateSupportPaths(existingTicket.id, submissionId)
        return { success: true, ticketId: existingTicket.id }
      }

      const ticket = await createAdminSupportTicket({
        phoneE164,
        submissionId,
        adminSummary: `Admin opened support ticket for ${submission.patientFirstName} ${submission.patientLastName}.`,
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
  const activeTickets = await findActiveSupportTicketsForQueue()

  const remaining = 200 - activeTickets.length
  if (remaining <= 0) return activeTickets

  const closedTickets = await findClosedSupportTicketsForQueue(remaining)

  return [...activeTickets, ...closedTickets]
}
