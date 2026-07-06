import { sendSmsSupportTicketAlertEmail } from '@/lib/email'
import prisma from '@/lib/prisma'

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
  const ticket = await prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    select: { csrAlertedAt: true },
  })

  if (!ticket || ticket.csrAlertedAt) return

  try {
    await sendSmsSupportTicketAlertEmail({
      ticketId,
      phoneE164,
      category: category || null,
      submissionId,
      summary,
    })

    await prisma.smsSupportTicket.updateMany({
      where: { id: ticketId, csrAlertedAt: null },
      data: { csrAlertedAt: new Date() },
    })
  } catch (error) {
    console.warn('SMS support ticket alert email failed:', {
      ticketId,
      error: error instanceof Error ? error.message : 'Unknown alert error',
    })
  }
}
