export const SMS_SUPPORT_STATUS = {
  OPEN: 'OPEN',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  RUNNING_AUTOMATION: 'RUNNING_AUTOMATION',
  NEEDS_CSR: 'NEEDS_CSR',
  CLOSED: 'CLOSED',
} as const

export type SmsSupportStatus = (typeof SMS_SUPPORT_STATUS)[keyof typeof SMS_SUPPORT_STATUS]

export const SMS_SUPPORT_CATEGORY = {
  NOTE_NOT_RECEIVED: 'NOTE_NOT_RECEIVED',
  ISSUE_DATE: 'ISSUE_DATE',
  CHANGE_DOB: 'CHANGE_DOB',
  CHANGE_DATES: 'CHANGE_DATES',
  CHANGE_PURPOSE: 'CHANGE_PURPOSE',
  REFUND: 'REFUND',
  DIAGNOSIS_SYMPTOMS: 'DIAGNOSIS_SYMPTOMS',
  RETURN_DATE: 'RETURN_DATE',
  ADDITIONAL_FORM: 'ADDITIONAL_FORM',
  NAME_CORRECTION: 'NAME_CORRECTION',
  RESTRICTIONS_ACCOMMODATIONS: 'RESTRICTIONS_ACCOMMODATIONS',
  OTHER: 'OTHER',
} as const

export type SmsSupportCategory = (typeof SMS_SUPPORT_CATEGORY)[keyof typeof SMS_SUPPORT_CATEGORY]

export const SMS_SUPPORT_SOURCE = {
  INBOUND_SMS: 'INBOUND_SMS',
  ADMIN_CREATED: 'ADMIN_CREATED',
  SUPPORT_FORM: 'SUPPORT_FORM',
} as const

export type SmsSupportSource = (typeof SMS_SUPPORT_SOURCE)[keyof typeof SMS_SUPPORT_SOURCE]

export const SMS_SUPPORT_STATE = {
  INTRO_MENU: 'INTRO_MENU',
  CHANGE_NOTE_MENU: 'CHANGE_NOTE_MENU',
  OTHER_MENU: 'OTHER_MENU',
  COLLECT_SUBMISSION_REF: 'COLLECT_SUBMISSION_REF',
  NOTE_NOT_RECEIVED_COLLECT_EMAIL: 'NOTE_NOT_RECEIVED_COLLECT_EMAIL',
  CHANGE_DOB_COLLECT: 'CHANGE_DOB_COLLECT',
  CHANGE_DATES_COLLECT_FIRST: 'CHANGE_DATES_COLLECT_FIRST',
  CHANGE_DATES_COLLECT_LAST: 'CHANGE_DATES_COLLECT_LAST',
  CHANGE_PURPOSE_COLLECT: 'CHANGE_PURPOSE_COLLECT',
  DIAGNOSIS_SYMPTOMS_CONFIRM: 'DIAGNOSIS_SYMPTOMS_CONFIRM',
  NAME_CORRECTION_COLLECT: 'NAME_CORRECTION_COLLECT',
  RESTRICTIONS_CONFIRM: 'RESTRICTIONS_CONFIRM',
  REFUND_COLLECT_REASON: 'REFUND_COLLECT_REASON',
  OTHER_COLLECT_MESSAGE: 'OTHER_COLLECT_MESSAGE',
  CSR_REVIEW: 'CSR_REVIEW',
  CLOSED: 'CLOSED',
} as const

export type SmsSupportState = (typeof SMS_SUPPORT_STATE)[keyof typeof SMS_SUPPORT_STATE]

export const SMS_SUPPORT_AUTOMATION_KIND = {
  UPDATE_DOB_REISSUE_NOTE: 'UPDATE_DOB_REISSUE_NOTE',
  UPDATE_PURPOSE_REISSUE_NOTE: 'UPDATE_PURPOSE_REISSUE_NOTE',
} as const

export type SmsSupportAutomationKind =
  (typeof SMS_SUPPORT_AUTOMATION_KIND)[keyof typeof SMS_SUPPORT_AUTOMATION_KIND]

export const SMS_SUPPORT_AUTOMATION_STATUS = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
} as const

export type SmsSupportAutomationStatus =
  (typeof SMS_SUPPORT_AUTOMATION_STATUS)[keyof typeof SMS_SUPPORT_AUTOMATION_STATUS]

export const SMS_SUPPORT_JOB_KIND = {
  RUN_SUPPORT_AUTOMATION: 'RUN_SUPPORT_AUTOMATION',
} as const

export type SmsSupportJobKind = (typeof SMS_SUPPORT_JOB_KIND)[keyof typeof SMS_SUPPORT_JOB_KIND]

export const SMS_SUPPORT_JOB_STATUS = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMMITTING: 'COMMITTING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const

export type SmsSupportJobStatus =
  (typeof SMS_SUPPORT_JOB_STATUS)[keyof typeof SMS_SUPPORT_JOB_STATUS]

export type SmsSupportCollectedData = {
  pendingCategory?: SmsSupportCategory
  pendingState?: SmsSupportState
  submissionReference?: string
  patientDateOfBirth?: string
  notePurpose?: string
  otherNotePurpose?: string | null
  correctedEmail?: string
  refundReason?: string
  freeformMessage?: string
}

export function supportStatusLabel(status: string): string {
  switch (status) {
    case SMS_SUPPORT_STATUS.OPEN:
      return 'Open'
    case SMS_SUPPORT_STATUS.WAITING_CUSTOMER:
      return 'Waiting on Customer'
    case SMS_SUPPORT_STATUS.RUNNING_AUTOMATION:
      return 'Running Automation'
    case SMS_SUPPORT_STATUS.NEEDS_CSR:
      return 'Needs Admin'
    case SMS_SUPPORT_STATUS.CLOSED:
      return 'Closed'
    default:
      return labelFromConstant(status)
  }
}

export function supportCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Uncategorized'

  switch (category) {
    case SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED:
      return 'Note Not Received'
    case SMS_SUPPORT_CATEGORY.ISSUE_DATE:
      return 'Issue/Evaluation Date'
    case SMS_SUPPORT_CATEGORY.CHANGE_DOB:
      return 'Change Birthday'
    case SMS_SUPPORT_CATEGORY.CHANGE_DATES:
      return 'Change Dates'
    case SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE:
      return 'Change Purpose'
    case SMS_SUPPORT_CATEGORY.REFUND:
      return 'Refund'
    case SMS_SUPPORT_CATEGORY.DIAGNOSIS_SYMPTOMS:
      return 'Diagnosis/Symptoms'
    case SMS_SUPPORT_CATEGORY.RETURN_DATE:
      return 'Return Date'
    case SMS_SUPPORT_CATEGORY.ADDITIONAL_FORM:
      return 'Additional Form'
    case SMS_SUPPORT_CATEGORY.NAME_CORRECTION:
      return 'Name Correction'
    case SMS_SUPPORT_CATEGORY.RESTRICTIONS_ACCOMMODATIONS:
      return 'Restrictions/Accommodations'
    case SMS_SUPPORT_CATEGORY.OTHER:
      return 'Other'
    default:
      return labelFromConstant(category)
  }
}

function labelFromConstant(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
