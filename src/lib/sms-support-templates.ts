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
    ['OnlineDoctorNote support:', '1 Note not received', '2 Change note', '3 Other'].join('\n')
  )
}

export function changeNoteMenuSms(): string {
  return withSupportStopCopy(
    [
      'What needs changing?',
      '1 Issue/evaluation date',
      '2 First/last day off',
      '3 Birthday',
      '4 Return date',
      '5 Diagnosis/symptoms',
      '6 Work/school/travel purpose',
      '7 Name misspelled',
      '8 Restrictions/accommodations',
      '9 Other',
    ].join('\n')
  )
}

export function otherMenuSms(): string {
  return withSupportStopCopy(
    ['What else do you need?', '1 Additional form', '2 Refund', '3 Other'].join('\n')
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
    'First/last day off changes need staff review. Email hello@onlinedoctornote.com with the correct dates.'
  )
}

export function issueDateManualSms(): string {
  return withSupportStopCopy(
    'The issue/evaluation date cannot be changed by text. Email hello@onlinedoctornote.com if you still need staff help.'
  )
}

export function returnDateInfoSms(): string {
  return withSupportStopCopy(
    'Notes show a return date of after the last day off. Email hello@onlinedoctornote.com if you still need staff help.'
  )
}

export function diagnosisSymptomsConfirmSms(): string {
  return withSupportStopCopy(
    'Diagnosis/symptom changes may involve protected health information. Reply 1 if you still want staff to review this request.'
  )
}

export function nameCorrectionPromptSms(): string {
  return withSupportStopCopy('Reply with the correct spelling of the first and last name.')
}

export function restrictionsConfirmSms(): string {
  return withSupportStopCopy(
    'We cannot add restrictions or accommodations. Reply 1 if you want staff to review removing "no restrictions."'
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
      'Legal notes need staff review.',
    ].join('\n')
  )
}

export function noteNotReceivedSms(): string {
  return withSupportStopCopy(
    'Please check spam/promotions first. If still missing, reply with the correct email address and staff will help.'
  )
}

export function additionalFormManualSms(): string {
  return withSupportStopCopy(
    'Email the form as a PDF to hello@onlinedoctornote.com. Staff will review it as soon as possible.'
  )
}

export function refundManualSms(): string {
  return withSupportStopCopy(
    'Email hello@onlinedoctornote.com and staff will review the refund request.'
  )
}

export function askRefundReasonSms(): string {
  return withSupportStopCopy(
    'Reply with a short refund reason. Staff will review it in the support queue.'
  )
}

export function askOtherMessageSms(): string {
  return withSupportStopCopy(
    'Reply with a short message. Staff will review it in the support queue.'
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
    'Thanks. A support ticket was created for staff review. We will follow up as soon as possible.'
  )
}

export function automationBlockedSms(reason: string): string {
  return withSupportStopCopy(
    `We could not safely automate that by text: ${reason}. Staff will review your ticket.`
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
    'We are still processing that update. Staff can see the ticket if anything needs review.'
  )
}

export function adminSupportReplySms(message: string): string {
  return withSupportStopCopy(`OnlineDoctorNote support: ${message}`)
}
