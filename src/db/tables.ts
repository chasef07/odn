import { col, defineTable, jsonCol, nullable, nullableJson, uuid } from './table'
import {
  lifecycleColumns,
  refundColumns,
  type Account,
  type NoteVerification,
  type ResendWebhookEvent,
  type Session,
  type SmsMessage,
  type SmsPhoneState,
  type SmsSupportJob,
  type SmsSupportTicket,
  type Submission,
  type SubmissionBirth,
  type SubmissionDetails,
  type TelnyxWebhookEvent,
  type TemporarySubmission,
  type User,
  type Verification,
} from './types'

function without<T extends object, K extends keyof T>(object: T, keys: readonly K[]): Omit<T, K> {
  const rest = { ...object }
  for (const key of keys) delete rest[key]
  return rest
}

export const users = defineTable<User>('users', {
  id: uuid('id'),
  email: col('email', 'text'),
  emailVerified: col('email_verified', 'bool'),
  name: col('name', 'text'),
  image: nullable('image', 'text'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const accounts = defineTable<Account>('accounts', {
  id: uuid('id'),
  userId: col('user_id', 'text'),
  accountId: col('account_id', 'text'),
  providerId: col('provider_id', 'text'),
  accessToken: nullable('access_token', 'text'),
  refreshToken: nullable('refresh_token', 'text'),
  idToken: nullable('id_token', 'text'),
  expiresAt: nullable('expires_at', 'timestamp'),
  refreshTokenExpiresAt: nullable('refresh_token_expires_at', 'timestamp'),
  scope: nullable('scope', 'text'),
  password: nullable('password', 'text'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const sessions = defineTable<Session>('sessions', {
  id: uuid('id'),
  userId: col('user_id', 'text'),
  token: col('token', 'text'),
  expiresAt: col('expires_at', 'timestamp'),
  ipAddress: nullable('ip_address', 'text'),
  userAgent: nullable('user_agent', 'text'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const verifications = defineTable<Verification>('verifications', {
  id: uuid('id'),
  identifier: col('identifier', 'text'),
  value: col('value', 'text'),
  expiresAt: col('expires_at', 'timestamp'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const temporarySubmissions = defineTable<TemporarySubmission>('temporary_submissions', {
  id: uuid('id'),
  paymentIntentId: col('payment_intent_id', 'text'),
  formData: jsonCol('form_data'),
  createdAt: col('created_at', 'timestamp'),
  expiresAt: col('expires_at', 'timestamp'),
})

export const submissions = defineTable<Submission>('submissions', {
  id: uuid('id'),
  stripePaymentIntentId: col('stripe_payment_intent_id', 'text'),
  paymentAmount: nullable('payment_amount', 'int'),
  offerCode: nullable('offer_code', 'text'),
  offerPriceId: nullable('offer_price_id', 'text'),
  attributionChannel: nullable('attribution_channel', 'text'),
  utmSource: nullable('utm_source', 'text'),
  utmMedium: nullable('utm_medium', 'text'),
  utmCampaign: nullable('utm_campaign', 'text'),
  attribution: nullableJson('attribution'),
  status: col('status', 'enum'),
  state: col('state', 'text'),
  recipient: col('recipient', 'text'),
  patientFirstName: col('patient_first_name', 'text'),
  patientLastName: col('patient_last_name', 'text'),
  patientDateOfBirth: col('patient_date_of_birth', 'date'),
  guardianFirstName: nullable('guardian_first_name', 'text'),
  guardianLastName: nullable('guardian_last_name', 'text'),
  guardianDateOfBirth: nullable('guardian_date_of_birth', 'date'),
  email: col('email', 'text'),
  phone: col('phone', 'text'),
  smsOptIn: col('sms_opt_in', 'bool'),
  smsOptInAt: nullable('sms_opt_in_at', 'timestamp'),
  smsConsentVersion: nullable('sms_consent_version', 'text'),
  smsPhoneE164: nullable('sms_phone_e164', 'text'),
  notePurpose: col('note_purpose', 'text'),
  otherNotePurpose: nullable('other_note_purpose', 'text'),
  firstDayOff: col('first_day_off', 'date'),
  lastDayOff: col('last_day_off', 'date'),
  absenceReason: col('absence_reason', 'text'),
  otherAbsenceReason: nullable('other_absence_reason', 'text'),
  symptoms: nullableJson('symptoms'),
  otherSymptomText: nullable('other_symptom_text', 'text'),
  additionalInformation: nullable('additional_information', 'text'),
  reviewedAt: nullable('reviewed_at', 'timestamp'),
  reviewedByAdminId: nullable('reviewed_by_admin_id', 'text'),
  denialReason: nullable('denial_reason', 'text'),
  maybeReason: nullable('maybe_reason', 'text'),
  maybeInternalNote: nullable('maybe_internal_note', 'text'),
  maybeApprovedDays: nullable('maybe_approved_days', 'int'),
  maybeEmailSentAt: nullable('maybe_email_sent_at', 'timestamp'),
  stripeRefundId: nullable('stripe_refund_id', 'text'),
  refundedAt: nullable('refunded_at', 'timestamp'),
  approvalEmailSentAt: nullable('approval_email_sent_at', 'timestamp'),
  denialEmailSentAt: nullable('denial_email_sent_at', 'timestamp'),
  followUpEmailClaimedAt: nullable('follow_up_email_claimed_at', 'timestamp'),
  followUpEmailSentAt: nullable('follow_up_email_sent_at', 'timestamp'),
  approvalDiagnosis: nullable('approval_diagnosis', 'text'),
  approvalWithRestrictions: nullable('approval_with_restrictions', 'bool'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const submissionBirth = defineTable<SubmissionBirth>(
  submissions.name,
  without(submissions.columns, refundColumns)
)

export const submissionDetails = defineTable<SubmissionDetails>(
  submissions.name,
  without(submissions.columns, lifecycleColumns)
)

export const smsPhoneStates = defineTable<SmsPhoneState>('sms_phone_states', {
  phoneE164: col('phone_e164', 'text'),
  optedOutAt: nullable('opted_out_at', 'timestamp'),
  lastOptInAt: nullable('last_opt_in_at', 'timestamp'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const smsMessages = defineTable<SmsMessage>('sms_messages', {
  id: uuid('id'),
  submissionId: nullable('submission_id', 'text'),
  supportTicketId: nullable('support_ticket_id', 'text'),
  type: col('type', 'text'),
  direction: col('direction', 'text'),
  to: nullable('to', 'text'),
  from: nullable('from', 'text'),
  body: col('body', 'text'),
  providerMessageId: nullable('provider_message_id', 'text'),
  providerStatus: nullable('provider_status', 'text'),
  errorCode: nullable('error_code', 'text'),
  errorMessage: nullable('error_message', 'text'),
  supportHandledAt: nullable('support_handled_at', 'timestamp'),
  sentAt: nullable('sent_at', 'timestamp'),
  receivedAt: nullable('received_at', 'timestamp'),
  finalizedAt: nullable('finalized_at', 'timestamp'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const smsSupportTickets = defineTable<SmsSupportTicket>('sms_support_tickets', {
  id: uuid('id'),
  phoneE164: col('phone_e164', 'text'),
  submissionId: nullable('submission_id', 'text'),
  status: col('status', 'text'),
  category: nullable('category', 'text'),
  state: col('state', 'text'),
  source: col('source', 'text'),
  automationKind: nullable('automation_kind', 'text'),
  automationStatus: nullable('automation_status', 'text'),
  collectedData: nullableJson('collected_data'),
  adminSummary: nullable('admin_summary', 'text'),
  failureReason: nullable('failure_reason', 'text'),
  retryCount: col('retry_count', 'int'),
  csrAlertedAt: nullable('csr_alerted_at', 'timestamp'),
  lastInboundAt: nullable('last_inbound_at', 'timestamp'),
  lastOutboundAt: nullable('last_outbound_at', 'timestamp'),
  closedAt: nullable('closed_at', 'timestamp'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const smsSupportJobs = defineTable<SmsSupportJob>('sms_support_jobs', {
  id: uuid('id'),
  ticketId: col('ticket_id', 'text'),
  kind: col('kind', 'text'),
  status: col('status', 'text'),
  payload: nullableJson('payload'),
  attempts: col('attempts', 'int'),
  lockedAt: nullable('locked_at', 'timestamp'),
  lockedBy: nullable('locked_by', 'text'),
  lastError: nullable('last_error', 'text'),
  runAfter: col('run_after', 'timestamp'),
  completedAt: nullable('completed_at', 'timestamp'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
})

export const telnyxWebhookEvents = defineTable<TelnyxWebhookEvent>('telnyx_webhook_events', {
  id: col('id', 'text'),
  eventType: col('event_type', 'text'),
  occurredAt: col('occurred_at', 'timestamp'),
  status: col('status', 'text'),
  lastError: nullable('last_error', 'text'),
  processedAt: col('processed_at', 'timestamp'),
})

export const resendWebhookEvents = defineTable<ResendWebhookEvent>('resend_webhook_events', {
  id: col('id', 'text'),
  emailId: nullable('email_id', 'text'),
  eventType: col('event_type', 'text'),
  processedAt: col('processed_at', 'timestamp'),
})

export const noteVerifications = defineTable<NoteVerification>('note_verifications', {
  id: uuid('id'),
  submissionId: col('submission_id', 'text'),
  medicalRecordNumber: col('medical_record_number', 'text'),
  verificationSlug: col('verification_slug', 'text'),
  status: col('status', 'enum'),
  issueDate: col('issue_date', 'date'),
  patientInitials: col('patient_initials', 'text'),
  firstDayOff: col('first_day_off', 'date'),
  lastDayOff: col('last_day_off', 'date'),
  returnGuidance: col('return_guidance', 'text'),
  physicianName: col('physician_name', 'text'),
  physicianCredentials: col('physician_credentials', 'text'),
  physicianNpi: nullable('physician_npi', 'text'),
  licenseState: nullable('license_state', 'text'),
  licenseNumber: nullable('license_number', 'text'),
  createdAt: col('created_at', 'timestamp'),
  updatedAt: col('updated_at', 'timestamp'),
  revokedAt: nullable('revoked_at', 'timestamp'),
})

export const tables = {
  users,
  accounts,
  sessions,
  verifications,
  temporarySubmissions,
  submissions,
  smsPhoneStates,
  smsMessages,
  smsSupportTickets,
  smsSupportJobs,
  telnyxWebhookEvents,
  resendWebhookEvents,
  noteVerifications,
}
