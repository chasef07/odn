import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { db } from './pool'
import { and, array, count, likeContains, likeStartsWith, or, sql, type Sql } from './sql'
import { insert, select, selectAll, set, type Patch } from './table'
import {
  noteVerifications,
  smsMessages,
  smsSupportJobs,
  smsSupportTickets,
  submissions,
} from './tables'
import {
  NoteVerificationStatus,
  SubmissionStatus,
  type JsonValue,
  type NoteVerification,
  type SmsMessage,
  type Submission,
} from './types'
import { deleteEveryRow } from './wipe'

export type MaybeReview = {
  maybeReason: string
  maybeInternalNote: string | null
  maybeApprovedDays: number | null
  reviewedByAdminId: string
  reviewedAt: Date
}

export type Review = {
  reviewedByAdminId: string
  reviewedAt: Date
}

export type StatusChange = Review & {
  updatedAt: Date
}

export type Approval = Review & {
  approvalDiagnosis: string | null
  approvalWithRestrictions: boolean
}

export type Denial = Review & {
  denialReason: string
}

export type SubmissionStatusFilter = {
  status: SubmissionStatus
  reviewedSince?: Date
}

export type SubmissionDetailsPatch = {
  patientFirstName?: string
  patientLastName?: string
  patientDateOfBirth?: Date
  guardianFirstName?: string | null
  guardianLastName?: string | null
  guardianDateOfBirth?: Date | null
  email?: string
  phone?: string
  state?: string
  notePurpose?: string
  otherNotePurpose?: string | null
  firstDayOff?: Date
  lastDayOff?: Date
  absenceReason?: string
  otherAbsenceReason?: string | null
  symptoms?: string[]
  otherSymptomText?: string | null
  additionalInformation?: string | null
  smsOptIn?: boolean
  smsOptInAt?: Date | null
  smsConsentVersion?: string | null
  smsPhoneE164?: string | null
}

export type ReviewClassification = {
  notePurpose: string
  otherNotePurpose: string | null
  absenceReason: string
  otherAbsenceReason: string | null
}

const detailColumns = keysOf<SubmissionDetailsPatch>({
  patientFirstName: true,
  patientLastName: true,
  patientDateOfBirth: true,
  guardianFirstName: true,
  guardianLastName: true,
  guardianDateOfBirth: true,
  email: true,
  phone: true,
  state: true,
  notePurpose: true,
  otherNotePurpose: true,
  firstDayOff: true,
  lastDayOff: true,
  absenceReason: true,
  otherAbsenceReason: true,
  symptoms: true,
  otherSymptomText: true,
  additionalInformation: true,
  smsOptIn: true,
  smsOptInAt: true,
  smsConsentVersion: true,
  smsPhoneE164: true,
})

const classificationColumns = keysOf<ReviewClassification>({
  notePurpose: true,
  otherNotePurpose: true,
  absenceReason: true,
  otherAbsenceReason: true,
})

function keysOf<T>(columns: Record<keyof T, true>): (keyof T)[] {
  return Object.keys(columns) as (keyof T)[]
}

function pick<T extends object>(source: T, keys: readonly (keyof T)[]): Partial<T> {
  const picked: Partial<T> = {}
  for (const key of keys) picked[key] = source[key]
  return picked
}

export type SubmissionSearch =
  | { by: 'anyName'; term: string }
  | { by: 'fullName'; firstName: string; lastName: string }
  | { by: 'email'; term: string }
  | { by: 'idPrefix'; prefix: string }
  | { by: 'medicalRecordNumber'; medicalRecordNumber: string }
  | { by: 'phone'; term: string }

export type PatientIdentity = {
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: Date
}

export type SubmissionSummary = Pick<
  Submission,
  | 'id'
  | 'patientFirstName'
  | 'patientLastName'
  | 'email'
  | 'status'
  | 'notePurpose'
  | 'firstDayOff'
  | 'lastDayOff'
  | 'createdAt'
>

export type PatientHistorySubmission = SubmissionSummary &
  Pick<Submission, 'reviewedAt' | 'denialReason'>

export type FriendsFamilyAnalyticsRow = Pick<
  Submission,
  | 'id'
  | 'status'
  | 'patientFirstName'
  | 'patientLastName'
  | 'patientDateOfBirth'
  | 'guardianFirstName'
  | 'guardianLastName'
  | 'recipient'
  | 'email'
  | 'phone'
  | 'maybeReason'
  | 'stripeRefundId'
  | 'refundedAt'
  | 'offerCode'
  | 'paymentAmount'
  | 'createdAt'
  | 'reviewedAt'
  | 'approvalEmailSentAt'
>

export type BusinessAnalyticsRow = Pick<
  Submission,
  | 'id'
  | 'status'
  | 'state'
  | 'patientFirstName'
  | 'patientLastName'
  | 'patientDateOfBirth'
  | 'email'
  | 'phone'
  | 'offerCode'
  | 'attributionChannel'
  | 'paymentAmount'
  | 'stripeRefundId'
  | 'refundedAt'
  | 'createdAt'
>

export type SubmissionSmsMessage = Pick<
  SmsMessage,
  | 'id'
  | 'type'
  | 'direction'
  | 'providerStatus'
  | 'errorCode'
  | 'errorMessage'
  | 'sentAt'
  | 'receivedAt'
  | 'finalizedAt'
  | 'createdAt'
>

export type SubmissionAdminDetail = Submission & {
  noteVerifications: NoteVerification[]
  smsMessages: SubmissionSmsMessage[]
}

const summaryKeys = [
  'id',
  'patientFirstName',
  'patientLastName',
  'email',
  'status',
  'notePurpose',
  'firstDayOff',
  'lastDayOff',
  'createdAt',
] as const

const friendsFamilyAnalyticsKeys = [
  'id',
  'status',
  'patientFirstName',
  'patientLastName',
  'patientDateOfBirth',
  'guardianFirstName',
  'guardianLastName',
  'recipient',
  'email',
  'phone',
  'maybeReason',
  'stripeRefundId',
  'refundedAt',
  'offerCode',
  'paymentAmount',
  'createdAt',
  'reviewedAt',
  'approvalEmailSentAt',
] as const

const contactKeys = [
  'id',
  'patientFirstName',
  'patientLastName',
  'email',
  'phone',
  'smsOptIn',
  'smsPhoneE164',
  'status',
] as const

function patientIdentityWhere({
  patientFirstName,
  patientLastName,
  patientDateOfBirth,
}: PatientIdentity): Sql {
  return and(
    sql`lower(patient_first_name) = lower(${patientFirstName})`,
    sql`lower(patient_last_name) = lower(${patientLastName})`,
    sql`patient_date_of_birth = ${patientDateOfBirth}`
  )
}

function hasNoteVerificationWithRecordNumber(medicalRecordNumber: string): Sql {
  return sql`EXISTS (SELECT 1 FROM note_verifications WHERE note_verifications.submission_id = submissions.id AND note_verifications.medical_record_number = ${medicalRecordNumber})`
}

async function countSubmissionsWhere(where: Sql): Promise<number> {
  const [row] = await db.rows(sql`SELECT ${count('n')} FROM submissions WHERE ${where}`)
  return row.n
}

export async function findSubmissionById(id: string): Promise<Submission | null> {
  return db.one(sql`SELECT ${selectAll(submissions)} FROM submissions WHERE id = ${id}`)
}

export async function findSubmissionStatus(id: string): Promise<Pick<Submission, 'status'> | null> {
  return db.one(sql`SELECT ${select(submissions, ['status'])} FROM submissions WHERE id = ${id}`)
}

export async function findSubmissionForDenial(
  id: string
): Promise<Pick<
  Submission,
  | 'id'
  | 'stripePaymentIntentId'
  | 'stripeRefundId'
  | 'email'
  | 'phone'
  | 'smsOptIn'
  | 'smsPhoneE164'
  | 'patientFirstName'
  | 'patientLastName'
  | 'status'
> | null> {
  return db.one(
    sql`SELECT ${select(submissions, [
      'id',
      'stripePaymentIntentId',
      'stripeRefundId',
      'email',
      'phone',
      'smsOptIn',
      'smsPhoneE164',
      'patientFirstName',
      'patientLastName',
      'status',
    ])} FROM submissions WHERE id = ${id}`
  )
}

export async function findSubmissionGuardianDetails(
  id: string
): Promise<Pick<
  Submission,
  | 'id'
  | 'patientDateOfBirth'
  | 'recipient'
  | 'guardianFirstName'
  | 'guardianLastName'
  | 'guardianDateOfBirth'
> | null> {
  return db.one(
    sql`SELECT ${select(submissions, [
      'id',
      'patientDateOfBirth',
      'recipient',
      'guardianFirstName',
      'guardianLastName',
      'guardianDateOfBirth',
    ])} FROM submissions WHERE id = ${id}`
  )
}

export async function findSubmissionSmsContact(
  id: string
): Promise<Pick<Submission, 'phone' | 'smsOptIn' | 'smsPhoneE164'> | null> {
  return db.one(
    sql`SELECT ${select(submissions, ['phone', 'smsOptIn', 'smsPhoneE164'])} FROM submissions WHERE id = ${id}`
  )
}

export async function findSubmissionForAdminDetail(
  id: string
): Promise<SubmissionAdminDetail | null> {
  const submission = await findSubmissionById(id)
  if (!submission) return null
  const [verifications, messages] = await Promise.all([
    db.rows(
      sql`SELECT ${selectAll(noteVerifications)} FROM note_verifications WHERE submission_id = ${id} AND status = ${NoteVerificationStatus.ACTIVE} AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`
    ),
    db.rows(
      sql`SELECT ${select(smsMessages, [
        'id',
        'type',
        'direction',
        'providerStatus',
        'errorCode',
        'errorMessage',
        'sentAt',
        'receivedAt',
        'finalizedAt',
        'createdAt',
      ])} FROM sms_messages WHERE submission_id = ${id} ORDER BY created_at DESC`
    ),
  ])
  return { ...submission, noteVerifications: verifications, smsMessages: messages }
}

export async function findSubmissionsPendingReview(): Promise<Submission[]> {
  return db.rows(
    sql`SELECT ${selectAll(submissions)} FROM submissions WHERE status = ${SubmissionStatus.PENDING_REVIEW} ORDER BY created_at ASC`
  )
}

function submissionStatusWhere({ status, reviewedSince }: SubmissionStatusFilter): Sql {
  return and(
    sql`status = ${status}`,
    reviewedSince !== undefined && sql`reviewed_at >= ${reviewedSince}`
  )
}

export async function findSubmissionIdsByStatus(
  filter: SubmissionStatusFilter,
  take: number
): Promise<Pick<Submission, 'id'>[]> {
  return db.rows(
    sql`SELECT ${select(submissions, ['id'])} FROM submissions WHERE ${submissionStatusWhere(filter)} LIMIT ${take}`
  )
}

export async function findSubmissionsApprovedSince(
  since: Date,
  take: number
): Promise<
  Pick<
    Submission,
    'id' | 'patientFirstName' | 'patientLastName' | 'email' | 'approvalEmailSentAt'
  >[]
> {
  return db.rows(
    sql`SELECT ${select(submissions, ['id', 'patientFirstName', 'patientLastName', 'email', 'approvalEmailSentAt'])} FROM submissions WHERE ${submissionStatusWhere({ status: SubmissionStatus.APPROVED, reviewedSince: since })} ORDER BY approval_email_sent_at DESC LIMIT ${take}`
  )
}

export async function findSubmissionsDeniedSince(
  since: Date,
  take: number
): Promise<
  Pick<Submission, 'id' | 'patientFirstName' | 'patientLastName' | 'email' | 'denialEmailSentAt'>[]
> {
  return db.rows(
    sql`SELECT ${select(submissions, ['id', 'patientFirstName', 'patientLastName', 'email', 'denialEmailSentAt'])} FROM submissions WHERE ${submissionStatusWhere({ status: SubmissionStatus.DENIED, reviewedSince: since })} ORDER BY denial_email_sent_at DESC LIMIT ${take}`
  )
}

export async function findMaybeSubmissions(): Promise<
  Pick<
    Submission,
    | 'id'
    | 'patientFirstName'
    | 'patientLastName'
    | 'email'
    | 'patientDateOfBirth'
    | 'recipient'
    | 'guardianFirstName'
    | 'guardianLastName'
    | 'guardianDateOfBirth'
    | 'firstDayOff'
    | 'lastDayOff'
    | 'maybeReason'
    | 'maybeApprovedDays'
    | 'maybeEmailSentAt'
    | 'reviewedAt'
  >[]
> {
  return db.rows(
    sql`SELECT ${select(submissions, [
      'id',
      'patientFirstName',
      'patientLastName',
      'email',
      'patientDateOfBirth',
      'recipient',
      'guardianFirstName',
      'guardianLastName',
      'guardianDateOfBirth',
      'firstDayOff',
      'lastDayOff',
      'maybeReason',
      'maybeApprovedDays',
      'maybeEmailSentAt',
      'reviewedAt',
    ])} FROM submissions WHERE status = ${SubmissionStatus.MAYBE} ORDER BY reviewed_at DESC`
  )
}

export async function findManualSubmissions(): Promise<
  Pick<
    Submission,
    | 'id'
    | 'patientFirstName'
    | 'patientLastName'
    | 'email'
    | 'firstDayOff'
    | 'lastDayOff'
    | 'reviewedAt'
  >[]
> {
  return db.rows(
    sql`SELECT ${select(submissions, ['id', 'patientFirstName', 'patientLastName', 'email', 'firstDayOff', 'lastDayOff', 'reviewedAt'])} FROM submissions WHERE status = ${SubmissionStatus.MANUAL} ORDER BY reviewed_at DESC`
  )
}

export async function findPatientHistory({
  patientFirstName,
  patientLastName,
  patientDateOfBirth,
  email,
  excludeSubmissionId,
}: PatientIdentity & {
  email: string
  excludeSubmissionId: string
}): Promise<PatientHistorySubmission[]> {
  const where = and(
    sql`id <> ${excludeSubmissionId}`,
    or(
      patientIdentityWhere({ patientFirstName, patientLastName, patientDateOfBirth }),
      sql`lower(email) = lower(${email})`
    )
  )
  return db.rows(
    sql`SELECT ${select(submissions, [...summaryKeys, 'reviewedAt', 'denialReason'])} FROM submissions WHERE ${where} ORDER BY created_at DESC LIMIT 20`
  )
}

function submissionSearchWhere(search: SubmissionSearch | null): Sql {
  if (!search) return and()

  switch (search.by) {
    case 'anyName':
      return or(
        sql`patient_first_name ILIKE ${likeContains(search.term)}`,
        sql`patient_last_name ILIKE ${likeContains(search.term)}`
      )
    case 'fullName':
      return and(
        sql`patient_first_name ILIKE ${likeContains(search.firstName)}`,
        sql`patient_last_name ILIKE ${likeContains(search.lastName)}`
      )
    case 'email':
      return sql`email ILIKE ${likeContains(search.term)}`
    case 'idPrefix':
      return sql`id LIKE ${likeStartsWith(search.prefix)}`
    case 'medicalRecordNumber':
      return hasNoteVerificationWithRecordNumber(search.medicalRecordNumber)
    case 'phone':
      return sql`phone LIKE ${likeContains(search.term)}`
  }
}

export async function searchSubmissionsPage(
  search: SubmissionSearch | null,
  { skip, take }: { skip: number; take: number }
): Promise<{ submissions: SubmissionSummary[]; total: number }> {
  const where = submissionSearchWhere(search)
  const [rows, total] = await Promise.all([
    db.rows(
      sql`SELECT ${select(submissions, summaryKeys)} FROM submissions WHERE ${where} ORDER BY created_at DESC LIMIT ${take} OFFSET ${skip}`
    ),
    countSubmissionsWhere(where),
  ])

  return { submissions: rows, total }
}

function createdSincePageWhere(createdSince: Date, cursor: string | undefined): Sql {
  return and(sql`created_at >= ${createdSince}`, cursor !== undefined && sql`id > ${cursor}`)
}

export async function findFriendsFamilyAnalyticsPage(
  createdSince: Date,
  take: number,
  cursor: string | undefined
): Promise<FriendsFamilyAnalyticsRow[]> {
  return db.rows(
    sql`SELECT ${select(submissions, friendsFamilyAnalyticsKeys)} FROM submissions WHERE ${createdSincePageWhere(createdSince, cursor)} ORDER BY id ASC LIMIT ${take}`
  )
}

export async function findBusinessAnalyticsPage(
  createdSince: Date,
  take: number,
  cursor: string | undefined
): Promise<BusinessAnalyticsRow[]> {
  return db.rows(
    sql`SELECT ${select(submissions, [
      'id',
      'status',
      'state',
      'patientFirstName',
      'patientLastName',
      'patientDateOfBirth',
      'email',
      'phone',
      'offerCode',
      'attributionChannel',
      'paymentAmount',
      'stripeRefundId',
      'refundedAt',
      'createdAt',
    ])} FROM submissions WHERE ${createdSincePageWhere(createdSince, cursor)} ORDER BY id ASC LIMIT ${take}`
  )
}

export async function findApprovedSubmissionsOverlapping(
  identity: PatientIdentity,
  { windowStart, windowEnd }: { windowStart: Date; windowEnd: Date }
): Promise<Pick<Submission, 'id' | 'firstDayOff' | 'lastDayOff' | 'reviewedAt'>[]> {
  const where = and(
    patientIdentityWhere(identity),
    sql`status = ${SubmissionStatus.APPROVED}`,
    sql`first_day_off <= ${windowEnd}`,
    sql`last_day_off >= ${windowStart}`
  )
  return db.rows(
    sql`SELECT ${select(submissions, ['id', 'firstDayOff', 'lastDayOff', 'reviewedAt'])} FROM submissions WHERE ${where} ORDER BY first_day_off ASC`
  )
}

async function updateById(id: string, patch: Patch<Submission>): Promise<void> {
  const affected = await db.affected(
    sql`UPDATE submissions SET ${set(submissions, patch)} WHERE id = ${id}`
  )
  if (affected === 0) throw new Error(`Submission ${id} not found`)
}

function maybePatch(review: MaybeReview): Patch<Submission> {
  return {
    status: SubmissionStatus.MAYBE,
    maybeReason: review.maybeReason,
    maybeInternalNote: review.maybeInternalNote,
    maybeApprovedDays: review.maybeApprovedDays,
    maybeEmailSentAt: null,
    reviewedByAdminId: review.reviewedByAdminId,
    reviewedAt: review.reviewedAt,
    updatedAt: review.reviewedAt,
  }
}

function reviewPatch(review: Review): Patch<Submission> {
  return { reviewedByAdminId: review.reviewedByAdminId, reviewedAt: review.reviewedAt }
}

function denialPatch(denial: Denial): Patch<Submission> {
  return {
    status: SubmissionStatus.DENIED,
    ...reviewPatch(denial),
    denialReason: denial.denialReason,
  }
}

function approvalPatch(approval: Approval): Patch<Submission> {
  return {
    status: SubmissionStatus.APPROVED,
    ...reviewPatch(approval),
    denialReason: null,
    approvalDiagnosis: approval.approvalDiagnosis,
    approvalWithRestrictions: approval.approvalWithRestrictions,
  }
}

const reviewableStatuses = array(
  [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
  '"SubmissionStatus"'
)

export async function markPendingSubmissionMaybe(id: string, review: MaybeReview): Promise<number> {
  return db.affected(
    sql`UPDATE submissions SET ${set(submissions, maybePatch(review))} WHERE id = ${id} AND status = ${SubmissionStatus.PENDING_REVIEW}`
  )
}

export async function markSubmissionMaybe(id: string, review: MaybeReview): Promise<void> {
  await updateById(id, maybePatch(review))
}

export async function recordMaybeEmailSent(id: string, sentAt: Date): Promise<void> {
  await updateById(id, { maybeEmailSentAt: sentAt })
}

export async function recordApprovalEmailSent(id: string, sentAt: Date): Promise<void> {
  await updateById(id, { approvalEmailSentAt: sentAt })
}

export async function recordDenialEmailSent(id: string, sentAt: Date): Promise<void> {
  await updateById(id, { denialEmailSentAt: sentAt })
}

export async function markMaybeSubmissionManual(id: string, review: Review): Promise<void> {
  await updateById(id, { status: SubmissionStatus.MANUAL, ...reviewPatch(review) })
}

export async function markSubmissionManual(id: string, change: StatusChange): Promise<void> {
  await updateById(id, {
    status: SubmissionStatus.MANUAL,
    ...reviewPatch(change),
    updatedAt: change.updatedAt,
  })
}

export async function approveManualSubmission(id: string, review: Review): Promise<void> {
  await updateById(id, {
    status: SubmissionStatus.APPROVED,
    ...reviewPatch(review),
    denialReason: null,
    approvalEmailSentAt: null,
    approvalDiagnosis: null,
    approvalWithRestrictions: null,
  })
}

export async function approveReviewableSubmission(id: string, approval: Approval): Promise<number> {
  return db.affected(
    sql`UPDATE submissions SET ${set(submissions, approvalPatch(approval))} WHERE id = ${id} AND status = ANY(${reviewableStatuses})`
  )
}

export async function reapproveSubmission(
  id: string,
  expectedUpdatedAt: Date,
  approval: Approval
): Promise<number> {
  return db.affected(
    sql`UPDATE submissions SET ${set(submissions, { ...approvalPatch(approval), updatedAt: approval.reviewedAt })} WHERE id = ${id} AND status = ${SubmissionStatus.APPROVED} AND updated_at = ${expectedUpdatedAt}`
  )
}

export async function markSubmissionDenied(
  id: string,
  denial: Denial & StatusChange
): Promise<void> {
  await updateById(id, { ...denialPatch(denial), updatedAt: denial.updatedAt })
}

export async function markSubmissionDeniedAndRefunded(
  id: string,
  denial: Denial & StatusChange & { stripeRefundId: string; refundedAt: Date }
): Promise<void> {
  await updateById(id, {
    ...denialPatch(denial),
    updatedAt: denial.updatedAt,
    stripeRefundId: denial.stripeRefundId,
    refundedAt: denial.refundedAt,
  })
}

export async function denyManualSubmission(id: string, denial: Denial): Promise<void> {
  await updateById(id, { ...denialPatch(denial), denialEmailSentAt: null })
}

export async function markSubmissionRefundReserved(id: string, denial: Denial): Promise<number> {
  const patch: Patch<Submission> = {
    ...denialPatch(denial),
    stripeRefundId: `pending_${id}`,
    refundedAt: denial.reviewedAt,
  }
  return db.affected(
    sql`UPDATE submissions SET ${set(submissions, patch)} WHERE id = ${id} AND status = ANY(${reviewableStatuses}) AND stripe_refund_id IS NULL`
  )
}

export async function releaseSubmissionRefundReservation(id: string): Promise<void> {
  await updateById(id, {
    status: SubmissionStatus.PENDING_REVIEW,
    stripeRefundId: null,
    reviewedByAdminId: null,
    reviewedAt: null,
    refundedAt: null,
    denialReason: null,
  })
}

export async function recordSubmissionRefund(id: string, stripeRefundId: string): Promise<void> {
  await updateById(id, { stripeRefundId })
}

export async function returnSubmissionToReview(id: string, updatedAt: Date): Promise<void> {
  await updateById(id, {
    status: SubmissionStatus.PENDING_REVIEW,
    reviewedByAdminId: null,
    reviewedAt: null,
    updatedAt,
  })
}

export async function removeSubmissionGuardian(id: string, updatedAt: Date): Promise<void> {
  await updateById(id, {
    recipient: 'myself',
    guardianFirstName: null,
    guardianLastName: null,
    guardianDateOfBirth: null,
    updatedAt,
  })
}

export async function updateSubmissionDetails(
  id: string,
  patch: SubmissionDetailsPatch,
  updatedAt: Date
): Promise<void> {
  await updateById(id, { ...pick(patch, detailColumns), updatedAt })
}

export async function updatePendingSubmissionClassification(
  id: string,
  classification: ReviewClassification,
  updatedAt: Date
): Promise<number> {
  return db.affected(
    sql`UPDATE submissions SET ${set(submissions, { ...pick(classification, classificationColumns), updatedAt })} WHERE id = ${id} AND status = ${SubmissionStatus.PENDING_REVIEW}`
  )
}

export type SubmissionInsert = {
  stripePaymentIntentId: string
  paymentAmount?: number | null
  offerCode?: string | null
  offerPriceId?: string | null
  attributionChannel?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  attribution?: JsonValue
  status?: SubmissionStatus
  denialReason?: string | null
  maybeReason?: string | null
  maybeInternalNote?: string | null
  maybeEmailSentAt?: Date | null
  state: string
  recipient: string
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: Date
  guardianFirstName?: string | null
  guardianLastName?: string | null
  guardianDateOfBirth?: Date | null
  email: string
  phone: string
  smsOptIn?: boolean
  smsOptInAt?: Date | null
  smsConsentVersion?: string | null
  smsPhoneE164?: string | null
  notePurpose: string
  otherNotePurpose?: string | null
  firstDayOff: Date
  lastDayOff: Date
  absenceReason: string
  otherAbsenceReason?: string | null
  symptoms?: JsonValue
  otherSymptomText?: string | null
  additionalInformation?: string | null
}

export type SubmissionInsertResult = { submission: Submission; inserted: boolean }

export async function insertSubmission(
  submission: SubmissionInsert
): Promise<SubmissionInsertResult> {
  const inserted = await db.one(
    sql`${insert(submissions, submission)} ON CONFLICT (stripe_payment_intent_id) DO NOTHING RETURNING ${selectAll(submissions)}`
  )
  if (inserted) return { submission: inserted, inserted: true }
  const existing = await db.one(
    sql`SELECT ${selectAll(submissions)} FROM submissions WHERE stripe_payment_intent_id = ${submission.stripePaymentIntentId}`
  )
  if (!existing) {
    throw new Error(
      `Submission for payment intent ${submission.stripePaymentIntentId} was neither inserted nor found`
    )
  }
  return { submission: existing, inserted: false }
}

export async function findSubmissionIdForPaymentIntent(
  stripePaymentIntentId: string
): Promise<Pick<Submission, 'id'> | null> {
  return db.one(
    sql`SELECT ${select(submissions, ['id'])} FROM submissions WHERE stripe_payment_intent_id = ${stripePaymentIntentId}`
  )
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const FOLLOW_UP_MIN_AGE_DAYS = 5
const FOLLOW_UP_MAX_AGE_DAYS = 7
const CLAIM_TIMEOUT_MS = 30 * 60 * 1000
const FOLLOW_UP_BATCH_SIZE = 100

function dueFollowUpEmailWhere(now: Date): Sql {
  return and(
    sql`status = ${SubmissionStatus.APPROVED}`,
    sql`approval_email_sent_at IS NOT NULL`,
    sql`follow_up_email_sent_at IS NULL`,
    sql`created_at >= ${new Date(now.getTime() - FOLLOW_UP_MAX_AGE_DAYS * MS_PER_DAY)}`,
    sql`created_at <= ${new Date(now.getTime() - FOLLOW_UP_MIN_AGE_DAYS * MS_PER_DAY)}`,
    or(
      sql`follow_up_email_claimed_at IS NULL`,
      sql`follow_up_email_claimed_at <= ${new Date(now.getTime() - CLAIM_TIMEOUT_MS)}`
    )
  )
}

export async function findDueFollowUpEmails(
  now: Date
): Promise<
  Pick<Submission, 'id' | 'email' | 'patientFirstName' | 'patientLastName' | 'notePurpose'>[]
> {
  return db.rows(
    sql`SELECT ${select(submissions, ['id', 'email', 'patientFirstName', 'patientLastName', 'notePurpose'])} FROM submissions WHERE ${dueFollowUpEmailWhere(now)} ORDER BY created_at ASC LIMIT ${FOLLOW_UP_BATCH_SIZE}`
  )
}

export async function claimDueFollowUpEmail(id: string, now: Date): Promise<number> {
  return db.affected(
    sql`UPDATE submissions SET ${set(submissions, { followUpEmailClaimedAt: now })} WHERE id = ${id} AND ${dueFollowUpEmailWhere(now)}`
  )
}

export async function releaseFollowUpEmailClaimAt(id: string, claimedAt: Date): Promise<void> {
  await db.affected(
    sql`UPDATE submissions SET ${set(submissions, { followUpEmailClaimedAt: null })} WHERE id = ${id} AND follow_up_email_sent_at IS NULL AND follow_up_email_claimed_at = ${claimedAt}`
  )
}

export async function acknowledgeFollowUpEmailSent(id: string, claimedAt: Date): Promise<number> {
  return db.affected(
    sql`UPDATE submissions SET ${set(submissions, { followUpEmailClaimedAt: null, followUpEmailSentAt: claimedAt })} WHERE id = ${id} AND follow_up_email_sent_at IS NULL AND follow_up_email_claimed_at = ${claimedAt}`
  )
}

export async function findLatestSubmission(): Promise<Submission | null> {
  return db.one(
    sql`SELECT ${selectAll(submissions)} FROM submissions ORDER BY created_at DESC LIMIT 1`
  )
}

export async function findApprovedSubmissionsForEmail(email: string): Promise<Submission[]> {
  return db.rows(
    sql`SELECT ${selectAll(submissions)} FROM submissions WHERE email = ${email} AND status = ${SubmissionStatus.APPROVED} ORDER BY reviewed_at DESC`
  )
}

export async function findApprovedSubmissionsMissingApprovalEmail(): Promise<Submission[]> {
  return db.rows(
    sql`SELECT ${selectAll(submissions)} FROM submissions WHERE status = ${SubmissionStatus.APPROVED} AND approval_email_sent_at IS NULL ORDER BY reviewed_at DESC`
  )
}

export async function countSubmissions(): Promise<number> {
  return countSubmissionsWhere(and())
}

export async function findRecentSubmissions(): Promise<
  Pick<
    Submission,
    'id' | 'email' | 'status' | 'createdAt' | 'patientFirstName' | 'patientLastName'
  >[]
> {
  return db.rows(
    sql`SELECT ${select(submissions, ['id', 'email', 'status', 'createdAt', 'patientFirstName', 'patientLastName'])} FROM submissions ORDER BY created_at DESC LIMIT 5`
  )
}

export async function countSubmissionsByStatus(): Promise<
  { status: SubmissionStatus; _count: number }[]
> {
  return db.rows(
    sql`SELECT ${select(submissions, ['status'])}, ${count('_count')} FROM submissions GROUP BY status`
  )
}

export async function deleteSubmissionById(id: string): Promise<void> {
  const affected = await db.affected(sql`DELETE FROM submissions WHERE id = ${id}`)
  if (affected === 0) throw new Error(`Submission ${id} not found`)
}

export async function deleteAllSubmissions(): Promise<number> {
  return deleteEveryRow(submissions)
}

export type SmsSupportAutomationSubmissionUpdate = {
  denialReason: null
  reviewedAt: Date
  updatedAt: Date
  patientDateOfBirth?: Date
  notePurpose?: string
  otherNotePurpose?: string | null
}

export type SmsSupportAutomationCommitResult = 'cancelled' | 'submission_changed' | 'updated'

export async function findLatestSubmissionIdForInboundSmsPhone(
  smsPhoneE164: string
): Promise<Pick<Submission, 'id'> | null> {
  return db.one(
    sql`SELECT ${select(submissions, ['id'])} FROM submissions WHERE sms_phone_e164 = ${smsPhoneE164} ORDER BY created_at DESC LIMIT 1`
  )
}

export async function countSmsOptedInSubmissionsForPhone(smsPhoneE164: string): Promise<number> {
  return countSubmissionsWhere(sql`sms_phone_e164 = ${smsPhoneE164} AND sms_opt_in`)
}

export async function findLatestSubmissionsForBouncedEmail(
  email: string
): Promise<
  Pick<
    Submission,
    | 'id'
    | 'patientFirstName'
    | 'patientLastName'
    | 'email'
    | 'phone'
    | 'smsOptIn'
    | 'smsPhoneE164'
    | 'status'
  >[]
> {
  return db.rows(
    sql`SELECT ${select(submissions, contactKeys)} FROM submissions WHERE email = ${email} ORDER BY created_at DESC LIMIT 2`
  )
}

export async function findSubmissionForSupportTicket(
  id: string
): Promise<Pick<
  Submission,
  'id' | 'smsOptIn' | 'smsPhoneE164' | 'patientFirstName' | 'patientLastName'
> | null> {
  return db.one(
    sql`SELECT ${select(submissions, ['id', 'smsOptIn', 'smsPhoneE164', 'patientFirstName', 'patientLastName'])} FROM submissions WHERE id = ${id}`
  )
}

export async function findSmsSupportSubmissionCandidatesForPhone(phoneE164: string): Promise<
  (Pick<Submission, 'id' | 'status'> & {
    smsMessages: Pick<SmsMessage, 'id'>[]
  })[]
> {
  const candidates = await db.rows(
    sql`SELECT ${select(submissions, ['id', 'status'])} FROM submissions WHERE sms_phone_e164 = ${phoneE164} AND sms_opt_in ORDER BY created_at DESC`
  )
  const sentMessages = await db.rows(
    sql`SELECT ${select(smsMessages, ['id', 'submissionId'])} FROM sms_messages WHERE submission_id = ANY(${array(candidates.map((candidate) => candidate.id))}) AND direction = 'outbound' AND "to" = ${phoneE164} AND sent_at IS NOT NULL`
  )
  return candidates.map((candidate) => {
    const sent = sentMessages.find((message) => message.submissionId === candidate.id)
    return { ...candidate, smsMessages: sent ? [{ id: sent.id }] : [] }
  })
}

export async function findApprovedSubmissionIdForSupportTicket(
  id: string
): Promise<Pick<Submission, 'id'> | null> {
  return db.one(
    sql`SELECT ${select(submissions, ['id'])} FROM submissions WHERE id = ${id} AND status = ${SubmissionStatus.APPROVED}`
  )
}

export async function findLatestApprovedSubmissionIdsForSupportPhone(
  smsPhoneE164: string
): Promise<Pick<Submission, 'id'>[]> {
  return db.rows(
    sql`SELECT ${select(submissions, ['id'])} FROM submissions WHERE sms_phone_e164 = ${smsPhoneE164} AND status = ${SubmissionStatus.APPROVED} ORDER BY created_at DESC LIMIT 2`
  )
}

export async function findApprovedSupportSubmissionIdsByReference(
  smsPhoneE164: string,
  { idPrefix, medicalRecordNumber }: { idPrefix?: string; medicalRecordNumber?: string }
): Promise<Pick<Submission, 'id'>[]> {
  const where = and(
    sql`sms_phone_e164 = ${smsPhoneE164}`,
    sql`status = ${SubmissionStatus.APPROVED}`,
    or(
      idPrefix !== undefined && sql`id LIKE ${likeStartsWith(idPrefix)}`,
      medicalRecordNumber !== undefined && hasNoteVerificationWithRecordNumber(medicalRecordNumber)
    )
  )
  return db.rows(sql`SELECT ${select(submissions, ['id'])} FROM submissions WHERE ${where} LIMIT 2`)
}

export async function findApprovedSubmissionBirthDateForSupport(
  id: string
): Promise<Pick<Submission, 'id' | 'patientDateOfBirth'> | null> {
  return db.one(
    sql`SELECT ${select(submissions, ['id', 'patientDateOfBirth'])} FROM submissions WHERE id = ${id} AND status = ${SubmissionStatus.APPROVED}`
  )
}

export async function commitSupportAutomationSubmissionUpdate({
  ticketId,
  jobId,
  submissionId,
  submissionUpdatedAt,
  committedAt,
  updateData,
}: {
  ticketId: string
  jobId: string
  submissionId: string
  submissionUpdatedAt: Date
  committedAt: Date
  updateData: SmsSupportAutomationSubmissionUpdate
}): Promise<SmsSupportAutomationCommitResult> {
  return db.transaction(async (tx) => {
    const ticketGuard = await tx.affected(
      sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, { failureReason: null })} WHERE id = ${ticketId} AND status = ${SMS_SUPPORT_STATUS.RUNNING_AUTOMATION} AND automation_status = ${SMS_SUPPORT_AUTOMATION_STATUS.RUNNING}`
    )

    if (ticketGuard !== 1) return 'cancelled'

    const jobGuard = await tx.affected(
      sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, { status: SMS_SUPPORT_JOB_STATUS.COMMITTING, lockedAt: committedAt })} WHERE id = ${jobId} AND status = ${SMS_SUPPORT_JOB_STATUS.RUNNING}`
    )

    if (jobGuard !== 1) return 'cancelled'

    const submissionUpdate = await tx.affected(
      sql`UPDATE submissions SET ${set(submissions, updateData)} WHERE id = ${submissionId} AND status = ${SubmissionStatus.APPROVED} AND updated_at = ${submissionUpdatedAt}`
    )

    if (submissionUpdate !== 1) return 'submission_changed'

    return 'updated'
  })
}
