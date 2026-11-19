import { claimOfflineNotice, findOfflineNoticePausedUntil } from '@/db/sms-offline-notice'
import type { SmsSupportTicket } from '@/db/types'
import { hourET, nextHourET, todayET, utcDateFromDateOnly, type Instant } from '@/lib/dates'
import { sendSupportSms } from '@/lib/sms-support-sms'
import { offlineNoticeSms } from '@/lib/sms-support-templates'

const TEAM_ONLINE_HOUR = 7

export function offlineNoticePauseEnd(at: Instant): Instant {
  return nextHourET(at, TEAM_ONLINE_HOUR)
}

export async function sendOfflineNotice(
  ticket: Pick<SmsSupportTicket, 'id' | 'phoneE164' | 'submissionId'>,
  receivedAt: Instant
): Promise<void> {
  if (hourET(receivedAt) >= TEAM_ONLINE_HOUR) return

  try {
    if (await findOfflineNoticePausedUntil(receivedAt)) return

    const night = utcDateFromDateOnly(todayET(receivedAt))
    if (!(await claimOfflineNotice(ticket.phoneE164, night))) return

    const result = await sendSupportSms({
      ticketId: ticket.id,
      submissionId: ticket.submissionId,
      toPhone: ticket.phoneE164,
      type: 'SUPPORT_OFFLINE_NOTICE',
      body: offlineNoticeSms(),
      conversation: false,
    })
    if (!result.success) {
      console.warn('SMS support offline notice was not sent:', {
        ticketId: ticket.id,
        error: result.error,
      })
    }
  } catch (error) {
    console.error('SMS support offline notice failed:', { ticketId: ticket.id, error })
  }
}
