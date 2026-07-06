import { supportCategoryLabel, type SmsSupportCategory } from '@/lib/sms-support-types'

const HELP_COPY = 'Reply HELP for note changes or customer support.'
const STOP_COPY = 'STOP to opt out.'

export function withSupportStopCopy(body: string): string {
  const hasHelpCopy = /\bHELP\b/.test(body)
  const hasStopCopy = /STOP to opt out\./i.test(body)
  if (hasHelpCopy && hasStopCopy) return body.trim()

  const cleanBody = body.trim().replace(/\s*STOP to opt out\.\s*$/i, '')
  const parts = [cleanBody]
  if (!hasHelpCopy) parts.push(HELP_COPY)
  parts.push(STOP_COPY)
  return parts.join('\n')
}

export function supportIntroMenuSms(): string {
  return withSupportStopCopy(
    [
      'How can we help? Reply with a number.',
      '1 I did not receive my note',
      '2 I need to change my note',
      '3 Other',
    ].join('\n')
  )
}

export function changeNoteMenuSms(): string {
  return withSupportStopCopy(
    [
      'Reply with a number.',
      '1 Issue/evaluation date',
      '2 First/last day off',
      '3 Date of birth',
      '4 Return date',
      '5 Add diagnosis/symptoms',
      '6 Change purpose to work/school/travel',
      '7 Name misspelled',
      '8 Need restrictions/accommodations',
      '9 Other',
    ].join('\n')
  )
}

export function otherMenuSms(): string {
  return withSupportStopCopy(
    ['Reply with a number.', '1 Need an additional form', '2 Need refund', '3 Other'].join('\n')
  )
}

export function askSubmissionReferenceSms(): string {
  return withSupportStopCopy(
    'We found more than one approved note for this phone. Reply with the Ref # from your text/email so we update the right note.'
  )
}

export function askDobSms(): string {
  return withSupportStopCopy(
    'Reply with the correct birthday as MM/DD/YYYY. If it is safe to update, we will email a new note.'
  )
}

export function dateChangeManualSms(): string {
  return withSupportStopCopy(
    'First/last day off changes need admin review. Email hello@onlinedoctornote.com with the correct dates.'
  )
}

export function issueDateManualSms(): string {
  return withSupportStopCopy(
    "We can't change the date; it reflects your request and doctor review. We can verify if needed."
  )
}

export function returnDateInfoSms(): string {
  return withSupportStopCopy(
    'Notes show a return date of AFTER the last day off. Email hello@onlinedoctornote.com if you still need admin help.'
  )
}

export function diagnosisSymptomsConfirmSms(): string {
  return withSupportStopCopy(
    'Diagnosis/symptom changes involve protected health information. Reply 1 if you still want admin to review this request.'
  )
}

export function nameCorrectionPromptSms(): string {
  return withSupportStopCopy('Reply with the correct spelling of the first and last name.')
}

export function restrictionsConfirmSms(): string {
  return withSupportStopCopy(
    'We cannot add restrictions or accommodations. Reply 1 if you want admin to review removing "no restrictions."'
  )
}

export function askPurposeSms(): string {
  return withSupportStopCopy(
    [
      'Reply with the new purpose:',
      '1 Work',
      '2 School',
      '3 Work and school',
      '4 Travel',
      'Legal notes need admin review.',
    ].join('\n')
  )
}

export function noteNotReceivedSms(): string {
  return withSupportStopCopy(
    'Please check your spam/junk folder. Reply 1 if you found it or 2 if you still cannot find it.'
  )
}

export function noteNotReceivedFoundSms(): string {
  return withSupportStopCopy('Great. No further action is needed for this support ticket.')
}

export function noteNotReceivedEmailSms(): string {
  return withSupportStopCopy('Reply with the correct email address and admin will help.')
}

export function additionalFormManualSms(): string {
  return withSupportStopCopy(
    'Email the form as a PDF to hello@onlinedoctornote.com. Admin will review it as soon as possible.'
  )
}

export function refundManualSms(): string {
  return withSupportStopCopy(
    'Email hello@onlinedoctornote.com and admin will review the refund request.'
  )
}

export function askRefundReasonSms(): string {
  return withSupportStopCopy(
    'Reply with a short refund reason. Admin will review it in the support queue.'
  )
}

export function askOtherMessageSms(): string {
  return withSupportStopCopy(
    'Reply with a short message. Admin will review it in the support queue.'
  )
}

export function automationQueuedSms(): string {
  return withSupportStopCopy(
    'Got it. We are updating your approved note now. You should receive a new email shortly.'
  )
}

export function automationSuccessSms(category: SmsSupportCategory): string {
  return withSupportStopCopy(
    `Done: your updated ${supportCategoryLabel(category).toLowerCase()} note was emailed. Check inbox/spam.`
  )
}

export function csrQueuedSms(): string {
  return withSupportStopCopy(
    'Thanks. A support ticket was created for admin review. We will follow up as soon as possible.'
  )
}

export function automationBlockedSms(reason: string): string {
  return withSupportStopCopy(
    `We could not safely automate that by text: ${reason}. Admin will review your ticket.`
  )
}

export function invalidDateSms(): string {
  return withSupportStopCopy('Please reply with a valid date in MM/DD/YYYY format.')
}

export function invalidPurposeSms(): string {
  return withSupportStopCopy(
    ['Please reply with one option:', '1 Work', '2 School', '3 Work and school', '4 Travel'].join(
      '\n'
    )
  )
}

export function automationStillRunningSms(): string {
  return withSupportStopCopy(
    'We are still processing that update. Admin can see the ticket if anything needs review.'
  )
}

export function adminSupportReplySms(message: string): string {
  return withSupportStopCopy(`OnlineDoctorNote support: ${message}`)
}
