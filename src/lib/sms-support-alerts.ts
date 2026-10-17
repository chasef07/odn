import { sendSmsSupportTicketAlertEmail } from '@/lib/email'
import { findSupportTicketCsrAlert, markSupportTicketCsrAlerted } from '@/db/sms-support'

export async function alertSupportTicketNeedsCsr({
  ticketId,
  phoneE164,
  category,
  submissionId,
  summary,
}: {
  ticketId: string
  phoneE164: string
  category?: string | null
  submissionId?: string | null
  summary: string
}): Promise<void> {
  const ticket = await findSupportTicketCsrAlert(ticketId)

  if (!ticket || ticket.csrAlertedAt) return

  try {
    await sendSmsSupportTicketAlertEmail({
      ticketId,
      phoneE164,
      category: category || null,
      submissionId,
      summary,
    })

    await markSupportTicketCsrAlerted(ticketId)
  } catch (error) {
    console.warn('SMS support ticket alert email failed:', {
      ticketId,
      error: error instanceof Error ? error.message : 'Unknown alert error',
    })
  }
}
