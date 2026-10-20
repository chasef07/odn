import type {
  SmsSupportAutomationKind,
  SmsSupportAutomationStatus,
  SmsSupportCategory,
  SmsSupportJobStatus,
  SmsSupportSource,
  SmsSupportState,
  SmsSupportStatus,
} from '@/lib/sms-support-types'

export const SubmissionStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  MAYBE: 'MAYBE',
  MANUAL: 'MANUAL',
} as const

export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus]

export const DENIAL_REASON_CHOICES = [
  'Legal',
  '7+ days',
  'Duplicate',
  'Refund (Customer)',
  'Refund (Denial)',
  'Under 18',
  'Accommodations',
  'Other',
] as const

export type DenialReasonChoice = (typeof DENIAL_REASON_CHOICES)[number]

export function isDenialReasonChoice(value: unknown): value is DenialReasonChoice {
  return DENIAL_REASON_CHOICES.some((choice) => choice === value)
}

export const DENIAL_REASONS = [...DENIAL_REASON_CHOICES, 'Refund'] as const

export type DenialReason = (typeof DENIAL_REASONS)[number]

export type DenialChoice = { readonly reason: DenialReasonChoice; readonly note: string | null }

export const NoteVerificationStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const

export type NoteVerificationStatus =
  (typeof NoteVerificationStatus)[keyof typeof NoteVerificationStatus]

export type JsonObject = { [Key in string]?: JsonValue }

export type JsonArray = JsonValue[]

export type JsonValue = string | number | boolean | JsonObject | JsonArray | null

export type Submission = {
  id: string
  stripePaymentIntentId: string
  paymentAmount: number | null
  offerCode: string | null
  offerPriceId: string | null
  attributionChannel: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  attribution: JsonValue | null
  status: SubmissionStatus
  state: string
  recipient: string
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: Date
  guardianFirstName: string | null
  guardianLastName: string | null
  guardianDateOfBirth: Date | null
  email: string
  phone: string
  smsOptIn: boolean
  smsOptInAt: Date | null
  smsConsentVersion: string | null
  smsPhoneE164: string | null
  notePurpose: string
  otherNotePurpose: string | null
  firstDayOff: Date
  lastDayOff: Date
  absenceReason: string
  otherAbsenceReason: string | null
  symptoms: JsonValue | null
  otherSymptomText: string | null
  additionalInformation: string | null
  reviewedAt: Date | null
  reviewedByAdminId: string | null
  denialReason: DenialReason | null
  denialNote: string | null
  maybeReason: string | null
  maybeInternalNote: string | null
  maybeApprovedDays: number | null
  maybeEmailSentAt: Date | null
  stripeRefundId: string | null
  refundedAt: Date | null
  approvalEmailSentAt: Date | null
  denialEmailSentAt: Date | null
  followUpEmailClaimedAt: Date | null
  followUpEmailSentAt: Date | null
  approvalDiagnosis: string | null
  approvalWithRestrictions: boolean | null
  createdAt: Date
  updatedAt: Date
}

export const refundColumns = ['stripeRefundId', 'refundedAt'] as const

export const lifecycleColumns = ['status', ...refundColumns] as const

export type RefundColumn = (typeof refundColumns)[number]

export type LifecycleColumn = (typeof lifecycleColumns)[number]

export type SubmissionBirth = Omit<Submission, RefundColumn>

export type SubmissionDetails = Omit<Submission, LifecycleColumn>

export type NoteVerification = {
  id: string
  submissionId: string
  medicalRecordNumber: string
  verificationSlug: string
  status: NoteVerificationStatus
  issueDate: Date
  patientInitials: string
  firstDayOff: Date
  lastDayOff: Date
  returnGuidance: string
  physicianName: string
  physicianCredentials: string
  physicianNpi: string | null
  licenseState: string | null
  licenseNumber: string | null
  createdAt: Date
  updatedAt: Date
  revokedAt: Date | null
}

export type TemporarySubmission = {
  id: string
  paymentIntentId: string
  formData: JsonValue
  createdAt: Date
  expiresAt: Date
}

export type SmsPhoneState = {
  phoneE164: string
  optedOutAt: Date | null
  lastOptInAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type SmsMessage = {
  id: string
  submissionId: string | null
  supportTicketId: string | null
  type: string
  direction: string
  to: string | null
  from: string | null
  body: string
  providerMessageId: string | null
  providerStatus: string | null
  errorCode: string | null
  errorMessage: string | null
  supportHandledAt: Date | null
  sentAt: Date | null
  receivedAt: Date | null
  finalizedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type SmsSupportTicket = {
  id: string
  phoneE164: string
  submissionId: string | null
  status: SmsSupportStatus
  category: SmsSupportCategory | null
  state: SmsSupportState
  source: SmsSupportSource
  automationKind: SmsSupportAutomationKind | null
  automationStatus: SmsSupportAutomationStatus | null
  collectedData: JsonValue | null
  adminSummary: string | null
  failureReason: string | null
  retryCount: number
  csrAlertedAt: Date | null
  lastInboundAt: Date | null
  lastOutboundAt: Date | null
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export const smsSupportLifecycleColumns = [
  'status',
  'state',
  'automationStatus',
  'closedAt',
] as const

export type SmsSupportLifecycleColumn = (typeof smsSupportLifecycleColumns)[number]

export type SmsSupportTicketDetails = Omit<SmsSupportTicket, SmsSupportLifecycleColumn>

export type SmsSupportJob = {
  id: string
  ticketId: string
  kind: string
  status: SmsSupportJobStatus
  payload: JsonValue | null
  attempts: number
  lockedAt: Date | null
  lockedBy: string | null
  lastError: string | null
  runAfter: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type User = {
  id: string
  email: string
  emailVerified: boolean
  name: string
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export type Account = {
  id: string
  userId: string
  accountId: string
  providerId: string
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  expiresAt: Date | null
  refreshTokenExpiresAt: Date | null
  scope: string | null
  password: string | null
  createdAt: Date
  updatedAt: Date
}

export type Verification = {
  id: string
  identifier: string
  value: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export type Session = {
  id: string
  userId: string
  token: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  updatedAt: Date
}

export type TelnyxWebhookEvent = {
  id: string
  eventType: string
  occurredAt: Date
  status: string
  lastError: string | null
  processedAt: Date
}

export type ResendWebhookEvent = {
  id: string
  emailId: string | null
  eventType: string
  processedAt: Date
}
