export const SMS_CONSENT_VERSION = 'transactional-sms-2026-06-16'

export type SmsMessageType =
  | 'PURCHASE_CONFIRMATION'
  | 'MAYBE_UPDATE'
  | 'APPROVAL_SENT'
  | 'DENIAL_SENT'
  | 'EMAIL_BOUNCE'

export function submissionReference(submissionId: string): string {
  return submissionId.slice(0, 8).toUpperCase()
}

export function purchaseConfirmationSms(submissionId: string): string {
  return `OnlineDoctorNote: Request received. Ref #${submissionReference(
    submissionId
  )}. Watch your email soon and check spam. STOP to opt out.`
}

export function emailBounceSms(): string {
  return 'OnlineDoctorNote: Your email bounced. Please email your correct email address to hello@onlinedoctornote.com. STOP to opt out.'
}

export function maybeUpdateSms(): string {
  return 'OnlineDoctorNote: Your request needs extra review. Please check your email for details. STOP to opt out.'
}

export function approvalSentSms(): string {
  return "OnlineDoctorNote: Your doctor's note was sent to your email. Check inbox/spam. STOP to opt out."
}

export function denialSentSms(): string {
  return 'OnlineDoctorNote: Your request was denied and refunded. Please check your email for details. STOP to opt out.'
}
