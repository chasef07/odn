export const SMS_CONSENT_VERSION = 'transactional-sms-2026-06-16'

export type SmsMessageType =
  | 'PURCHASE_CONFIRMATION'
  | 'MAYBE_UPDATE'
  | 'APPROVAL_SENT'
  | 'DENIAL_SENT'
  | 'EMAIL_BOUNCE'
  | 'INBOUND'
  | 'SUPPORT_REPLY'
  | 'SUPPORT_AUTOMATION_UPDATE'
  | 'SUPPORT_CSR_ALERT'

export function submissionReference(submissionId: string): string {
  return submissionId.slice(0, 8).toUpperCase()
}

const HELP_COPY = 'Reply HELP for note changes or customer support.'
const SHORT_HELP_COPY = 'Reply HELP for support.'
const STOP_COPY = 'STOP to opt out.'

function withSmsFooter(body: string, helpCopy = HELP_COPY): string {
  const hasHelpCopy = /\bHELP\b/.test(body)
  const hasStopCopy = /STOP to opt out\./i.test(body)
  if (hasHelpCopy && hasStopCopy) return body.trim()

  const cleanBody = body.trim().replace(/\s*STOP to opt out\.\s*$/i, '')
  const parts = [cleanBody]
  if (!hasHelpCopy) parts.push(helpCopy)
  parts.push(STOP_COPY)
  return parts.join('\n')
}

export function purchaseConfirmationSms(submissionId: string): string {
  return withSmsFooter(
    `OnlineDoctorNote: Request received. Ref #${submissionReference(
      submissionId
    )}. Watch email/spam.`,
    SHORT_HELP_COPY
  )
}

export function emailBounceSms(): string {
  return withSmsFooter(
    'OnlineDoctorNote: Your email bounced. Email your correct address to hello@onlinedoctornote.com.'
  )
}

export function maybeUpdateSms(): string {
  return withSmsFooter(
    'OnlineDoctorNote: Your request needs extra review. Please check your email for details.'
  )
}

export function approvalSentSms(): string {
  return withSmsFooter(
    "OnlineDoctorNote: Your doctor's note was sent to your email. Check inbox/spam.",
    SHORT_HELP_COPY
  )
}

export function denialSentSms(): string {
  return withSmsFooter(
    'OnlineDoctorNote: Your request was denied and refunded. Please check your email for details.'
  )
}
