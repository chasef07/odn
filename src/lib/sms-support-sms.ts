import {
  findSmsPhoneOptOut,
  findSupportTicketLastOutboundAt,
  recordSupportTicketOutbound,
} from '@/db/sms-support'
import { toE164UsPhone } from '@/lib/phone-utils'
import { sendTelnyxSms } from '@/lib/telnyx'
import type { SmsMessageType } from '@/lib/sms-templates'

const SUPPORT_FOOTER = [
  'Reply HELP for note changes or customer support.',
  'STOP to opt out.',
].join('\n')

function supportSmsBody(body: string, includeFooter: boolean): string {
  const trimmedBody = body.trim()
  const content = trimmedBody.endsWith(SUPPORT_FOOTER)
    ? trimmedBody.slice(0, -SUPPORT_FOOTER.length).trimEnd()
    : trimmedBody

  return includeFooter ? `${content}\n${SUPPORT_FOOTER}` : content
}

export async function sendSupportSms({
  ticketId,
  submissionId,
  toPhone,
  type = 'SUPPORT_REPLY',
  body,
  conversation = true,
}: {
  ticketId?: string
  submissionId?: string | null
  toPhone: string
  type?: SmsMessageType
  body: string
  conversation?: boolean
}): Promise<{ success: boolean; error?: string }> {
  const to = toE164UsPhone(toPhone)
  if (!to) return { success: false, error: 'Invalid SMS phone number' }

  const phoneState = await findSmsPhoneOptOut(to)

  if (phoneState?.optedOutAt) {
    return { success: false, error: 'Phone number is opted out' }
  }

  const conversationTicketId = conversation ? ticketId : undefined
  const includeFooter =
    !!conversationTicketId &&
    !(await findSupportTicketLastOutboundAt(conversationTicketId))?.lastOutboundAt

  const result = await sendTelnyxSms({
    submissionId: submissionId || undefined,
    supportTicketId: ticketId,
    type,
    toPhone: to,
    body: supportSmsBody(body, includeFooter),
  })

  if (result.success && conversationTicketId) {
    await recordSupportTicketOutbound(conversationTicketId)
  }

  return result.success ? { success: true } : { success: false, error: result.error }
}
