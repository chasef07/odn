import { supportCategoryLabel, type SmsSupportCategory } from '@/lib/sms-support-types'

const STOP_COPY = 'STOP to opt out.'

export function withSupportStopCopy(body: string): string {
  return body.includes(STOP_COPY) ? body : `${body} ${STOP_COPY}`
}

export function supportIntroMenuSms(): string {
  return withSupportStopCopy(
    'OnlineDoctorNote support: Reply 1 note not received, 2 change note, 3 refund, 4 diagnosis/symptoms, or 5 other.'
  )
}

export function changeNoteMenuSms(): string {
  return withSupportStopCopy(
    'What needs changing? Reply 1 birthday, 2 absence dates, 3 work/school purpose, 4 return date question, or 5 other.'
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

export function askFirstDayOffSms(): string {
  return withSupportStopCopy('Reply with the first day off as MM/DD/YYYY.')
}

export function askLastDayOffSms(): string {
  return withSupportStopCopy(
    'Reply with the last day off as MM/DD/YYYY. If valid, we will email a new note.'
  )
}

export function askPurposeSms(): string {
  return withSupportStopCopy(
    'Reply with the new purpose: 1 work, 2 school, 3 work and school, or 4 travel. Legal notes need staff review.'
  )
}

export function noteNotReceivedSms(): string {
  return withSupportStopCopy(
    'Please check spam/promotions first. If still missing, reply with the correct email address and staff will help.'
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
    'Please reply 1 for work, 2 for school, 3 for work and school, or 4 for travel.'
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
