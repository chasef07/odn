export const SubmissionStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  MAYBE: 'MAYBE',
  MANUAL: 'MANUAL',
} as const

export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus]

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
  denialReason: string | null
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
  status: string
  category: string | null
  state: string
  source: string
  automationKind: string | null
  automationStatus: string | null
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

export type SmsSupportJob = {
  id: string
  ticketId: string
  kind: string
  status: string
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
