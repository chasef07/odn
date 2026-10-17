import { Prisma } from '@prisma/client'
import prisma from './client'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import {
  NoteVerificationStatus,
  SubmissionStatus,
  type JsonValue,
  type NoteVerification,
  type SmsMessage,
  type Submission,
} from './types'

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

export type SubmissionSearch =
  | { by: 'anyName'; term: string }
  | { by: 'fullName'; firstName: string; lastName: string }
  | { by: 'email'; term: string }
  | { by: 'idPrefix'; prefix: string }
  | { by: 'medicalRecordNumber'; medicalRecordNumber: string }
  | { by: 'phone'; term: string }

export type CustomerMatch =
  | { by: 'email'; email: string }
  | { by: 'phone'; digits: string }
  | { by: 'patient'; firstName: string; lastName: string; dateOfBirth: Date }

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
  | 'notePurpose'
  | 'firstDayOff'
  | 'lastDayOff'
  | 'denialReason'
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

const friendsFamilyAnalyticsSelect = {
  id: true,
  status: true,
  patientFirstName: true,
  patientLastName: true,
  patientDateOfBirth: true,
  guardianFirstName: true,
  guardianLastName: true,
  recipient: true,
  email: true,
  phone: true,
  notePurpose: true,
  firstDayOff: true,
  lastDayOff: true,
  denialReason: true,
  maybeReason: true,
  stripeRefundId: true,
  refundedAt: true,
  offerCode: true,
  paymentAmount: true,
  createdAt: true,
  reviewedAt: true,
  approvalEmailSentAt: true,
} satisfies Prisma.SubmissionSelect

export async function findSubmissionById(id: string): Promise<Submission | null> {
  return prisma.submission.findUnique({
    where: { id },
  })
}

export async function findSubmissionStatus(id: string): Promise<Pick<Submission, 'status'> | null> {
  return prisma.submission.findUnique({
    where: { id },
    select: { status: true },
  })
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
  return prisma.submission.findUnique({
    where: { id },
    select: {
      id: true,
      stripePaymentIntentId: true,
      stripeRefundId: true,
      email: true,
      phone: true,
      smsOptIn: true,
      smsPhoneE164: true,
      patientFirstName: true,
      patientLastName: true,
      status: true,
    },
  })
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
  return prisma.submission.findUnique({
    where: { id },
    select: {
      id: true,
      patientDateOfBirth: true,
      recipient: true,
      guardianFirstName: true,
      guardianLastName: true,
      guardianDateOfBirth: true,
    },
  })
}

export async function findSubmissionSmsContact(
  id: string
): Promise<Pick<Submission, 'phone' | 'smsOptIn' | 'smsPhoneE164'> | null> {
  return prisma.submission.findUnique({
    where: { id },
    select: {
      phone: true,
      smsOptIn: true,
      smsPhoneE164: true,
    },
  })
}

export async function findSubmissionForAdminDetail(
  id: string
): Promise<SubmissionAdminDetail | null> {
  return prisma.submission.findUnique({
    where: { id },
    include: {
      noteVerifications: {
        where: {
          status: NoteVerificationStatus.ACTIVE,
          revokedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      smsMessages: {
        select: {
          id: true,
          type: true,
          direction: true,
          providerStatus: true,
          errorCode: true,
          errorMessage: true,
          sentAt: true,
          receivedAt: true,
          finalizedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function findSubmissionsPendingReview(): Promise<Submission[]> {
  return prisma.submission.findMany({
    where: {
      status: SubmissionStatus.PENDING_REVIEW,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
}

function submissionStatusWhere({
  status,
  reviewedSince,
}: SubmissionStatusFilter): Prisma.SubmissionWhereInput {
  return reviewedSince === undefined ? { status } : { status, reviewedAt: { gte: reviewedSince } }
}

export async function findSubmissionIdsByStatus(
  filter: SubmissionStatusFilter,
  take: number
): Promise<Pick<Submission, 'id'>[]> {
  return prisma.submission.findMany({
    where: submissionStatusWhere(filter),
    select: { id: true },
    take,
  })
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
  return prisma.submission.findMany({
    where: {
      status: SubmissionStatus.APPROVED,
      reviewedAt: { gte: since },
    },
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      email: true,
      approvalEmailSentAt: true,
    },
    orderBy: {
      approvalEmailSentAt: 'desc',
    },
    take,
  })
}

export async function findSubmissionsDeniedSince(
  since: Date,
  take: number
): Promise<
  Pick<Submission, 'id' | 'patientFirstName' | 'patientLastName' | 'email' | 'denialEmailSentAt'>[]
> {
  return prisma.submission.findMany({
    where: {
      status: SubmissionStatus.DENIED,
      reviewedAt: { gte: since },
    },
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      email: true,
      denialEmailSentAt: true,
    },
    orderBy: {
      denialEmailSentAt: 'desc',
    },
    take,
  })
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
  return prisma.submission.findMany({
    where: {
      status: SubmissionStatus.MAYBE,
    },
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      email: true,
      patientDateOfBirth: true,
      recipient: true,
      guardianFirstName: true,
      guardianLastName: true,
      guardianDateOfBirth: true,
      firstDayOff: true,
      lastDayOff: true,
      maybeReason: true,
      maybeApprovedDays: true,
      maybeEmailSentAt: true,
      reviewedAt: true,
    },
    orderBy: {
      reviewedAt: 'desc',
    },
  })
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
  return prisma.submission.findMany({
    where: {
      status: SubmissionStatus.MANUAL,
    },
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      email: true,
      firstDayOff: true,
      lastDayOff: true,
      reviewedAt: true,
    },
    orderBy: {
      reviewedAt: 'desc',
    },
  })
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
  return prisma.submission.findMany({
    where: {
      id: { not: excludeSubmissionId },
      OR: [
        {
          patientFirstName: { equals: patientFirstName, mode: 'insensitive' },
          patientLastName: { equals: patientLastName, mode: 'insensitive' },
          patientDateOfBirth: patientDateOfBirth,
        },
        {
          email: { equals: email, mode: 'insensitive' },
        },
      ],
    },
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      email: true,
      status: true,
      notePurpose: true,
      firstDayOff: true,
      lastDayOff: true,
      createdAt: true,
      reviewedAt: true,
      denialReason: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

function submissionSearchWhere(search: SubmissionSearch | null): Prisma.SubmissionWhereInput {
  if (!search) return {}

  switch (search.by) {
    case 'anyName':
      return {
        OR: [
          { patientFirstName: { contains: search.term, mode: 'insensitive' } },
          { patientLastName: { contains: search.term, mode: 'insensitive' } },
        ],
      }
    case 'fullName':
      return {
        AND: [
          { patientFirstName: { contains: search.firstName, mode: 'insensitive' } },
          { patientLastName: { contains: search.lastName, mode: 'insensitive' } },
        ],
      }
    case 'email':
      return { email: { contains: search.term, mode: 'insensitive' } }
    case 'idPrefix':
      return { id: { startsWith: search.prefix } }
    case 'medicalRecordNumber':
      return {
        noteVerifications: {
          some: {
            medicalRecordNumber: search.medicalRecordNumber,
          },
        },
      }
    case 'phone':
      return { phone: { contains: search.term } }
  }
}

export async function searchSubmissionsPage(
  search: SubmissionSearch | null,
  { skip, take }: { skip: number; take: number }
): Promise<{ submissions: SubmissionSummary[]; total: number }> {
  const where = submissionSearchWhere(search)
  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        email: true,
        status: true,
        notePurpose: true,
        firstDayOff: true,
        lastDayOff: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.submission.count({ where }),
  ])

  return { submissions, total }
}

export async function findFriendsFamilyAnalyticsPage(
  createdSince: Date,
  take: number,
  cursor: string | undefined
): Promise<FriendsFamilyAnalyticsRow[]> {
  return prisma.submission.findMany({
    where: {
      createdAt: { gte: createdSince },
    },
    select: friendsFamilyAnalyticsSelect,
    orderBy: { id: 'asc' },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
}

function customerMatchWhere(match: CustomerMatch): Prisma.SubmissionWhereInput {
  switch (match.by) {
    case 'email':
      return { email: { equals: match.email, mode: 'insensitive' } }
    case 'phone': {
      const digits = match.digits
      const phoneFilters: Prisma.SubmissionWhereInput[] = [{ phone: { contains: digits } }]

      if (digits.length >= 10) {
        const tenDigits = digits.slice(0, 10)
        phoneFilters.push({
          phone: {
            equals: `(${tenDigits.slice(0, 3)}) ${tenDigits.slice(3, 6)}-${tenDigits.slice(6, 10)}`,
          },
        })
        phoneFilters.push({
          AND: [
            { phone: { contains: tenDigits.slice(0, 3) } },
            { phone: { contains: tenDigits.slice(3, 6) } },
            { phone: { contains: tenDigits.slice(6, 10) } },
          ],
        })
      }

      return { OR: phoneFilters }
    }
    case 'patient':
      return {
        patientFirstName: { equals: match.firstName, mode: 'insensitive' },
        patientLastName: { equals: match.lastName, mode: 'insensitive' },
        patientDateOfBirth: match.dateOfBirth,
      }
  }
}

export async function findFriendsFamilyCustomerSubmissions(
  match: CustomerMatch
): Promise<FriendsFamilyAnalyticsRow[]> {
  return prisma.submission.findMany({
    where: customerMatchWhere(match),
    select: friendsFamilyAnalyticsSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function findBusinessAnalyticsPage(
  createdSince: Date,
  take: number,
  cursor: string | undefined
): Promise<BusinessAnalyticsRow[]> {
  return prisma.submission.findMany({
    where: { createdAt: { gte: createdSince } },
    select: {
      id: true,
      status: true,
      state: true,
      patientFirstName: true,
      patientLastName: true,
      patientDateOfBirth: true,
      email: true,
      phone: true,
      offerCode: true,
      attributionChannel: true,
      paymentAmount: true,
      stripeRefundId: true,
      refundedAt: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
}

export async function findApprovedSubmissionsOverlapping(
  { patientFirstName, patientLastName, patientDateOfBirth }: PatientIdentity,
  { windowStart, windowEnd }: { windowStart: Date; windowEnd: Date }
): Promise<Pick<Submission, 'id' | 'firstDayOff' | 'lastDayOff' | 'reviewedAt'>[]> {
  return prisma.submission.findMany({
    where: {
      patientFirstName: { equals: patientFirstName, mode: 'insensitive' },
      patientLastName: { equals: patientLastName, mode: 'insensitive' },
      patientDateOfBirth: patientDateOfBirth,
      status: SubmissionStatus.APPROVED,
      firstDayOff: {
        lte: windowEnd,
      },
      lastDayOff: {
        gte: windowStart,
      },
    },
    select: {
      id: true,
      firstDayOff: true,
      lastDayOff: true,
      reviewedAt: true,
    },
    orderBy: {
      firstDayOff: 'asc',
    },
  })
}

export async function markPendingSubmissionMaybe(id: string, review: MaybeReview): Promise<number> {
  const result = await prisma.submission.updateMany({
    where: {
      id,
      status: SubmissionStatus.PENDING_REVIEW,
    },
    data: {
      status: SubmissionStatus.MAYBE,
      maybeReason: review.maybeReason,
      maybeInternalNote: review.maybeInternalNote,
      maybeApprovedDays: review.maybeApprovedDays,
      maybeEmailSentAt: null,
      reviewedByAdminId: review.reviewedByAdminId,
      reviewedAt: review.reviewedAt,
      updatedAt: review.reviewedAt,
    },
  })
  return result.count
}

export async function markSubmissionMaybe(id: string, review: MaybeReview): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.MAYBE,
      maybeReason: review.maybeReason,
      maybeInternalNote: review.maybeInternalNote,
      maybeApprovedDays: review.maybeApprovedDays,
      maybeEmailSentAt: null,
      reviewedByAdminId: review.reviewedByAdminId,
      reviewedAt: review.reviewedAt,
      updatedAt: review.reviewedAt,
    },
  })
}

export async function recordMaybeEmailSent(id: string, sentAt: Date): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      maybeEmailSentAt: sentAt,
    },
  })
}

export async function recordApprovalEmailSent(id: string, sentAt: Date): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: { approvalEmailSentAt: sentAt },
  })
}

export async function recordDenialEmailSent(id: string, sentAt: Date): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: { denialEmailSentAt: sentAt },
  })
}

export async function markMaybeSubmissionManual(id: string, review: Review): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.MANUAL,
      reviewedByAdminId: review.reviewedByAdminId,
      reviewedAt: review.reviewedAt,
    },
  })
}

export async function markSubmissionManual(id: string, change: StatusChange): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.MANUAL,
      reviewedByAdminId: change.reviewedByAdminId,
      reviewedAt: change.reviewedAt,
      updatedAt: change.updatedAt,
    },
  })
}

export async function approveManualSubmission(
  id: string,
  { reviewedByAdminId, reviewedAt }: Review
): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.APPROVED,
      reviewedByAdminId,
      reviewedAt,
      denialReason: null,
      approvalEmailSentAt: null,
      approvalDiagnosis: null,
      approvalWithRestrictions: null,
    },
  })
}

export async function approveReviewableSubmission(id: string, approval: Approval): Promise<number> {
  const result = await prisma.submission.updateMany({
    where: {
      id,
      status: {
        in: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
      },
    },
    data: {
      status: SubmissionStatus.APPROVED,
      reviewedByAdminId: approval.reviewedByAdminId,
      reviewedAt: approval.reviewedAt,
      denialReason: null,
      approvalDiagnosis: approval.approvalDiagnosis,
      approvalWithRestrictions: approval.approvalWithRestrictions,
    },
  })
  return result.count
}

export async function reapproveSubmission(
  id: string,
  expectedUpdatedAt: Date,
  approval: Approval
): Promise<number> {
  const result = await prisma.submission.updateMany({
    where: {
      id,
      status: SubmissionStatus.APPROVED,
      updatedAt: expectedUpdatedAt,
    },
    data: {
      status: SubmissionStatus.APPROVED,
      reviewedByAdminId: approval.reviewedByAdminId,
      reviewedAt: approval.reviewedAt,
      denialReason: null,
      approvalDiagnosis: approval.approvalDiagnosis,
      approvalWithRestrictions: approval.approvalWithRestrictions,
      updatedAt: approval.reviewedAt,
    },
  })
  return result.count
}

export async function markSubmissionDenied(
  id: string,
  denial: Denial & StatusChange
): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.DENIED,
      denialReason: denial.denialReason,
      reviewedByAdminId: denial.reviewedByAdminId,
      reviewedAt: denial.reviewedAt,
      updatedAt: denial.updatedAt,
    },
  })
}

export async function markSubmissionDeniedAndRefunded(
  id: string,
  denial: Denial & StatusChange & { stripeRefundId: string; refundedAt: Date }
): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.DENIED,
      denialReason: denial.denialReason,
      reviewedByAdminId: denial.reviewedByAdminId,
      reviewedAt: denial.reviewedAt,
      stripeRefundId: denial.stripeRefundId,
      refundedAt: denial.refundedAt,
      updatedAt: denial.updatedAt,
    },
  })
}

export async function denyManualSubmission(id: string, denial: Denial): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.DENIED,
      denialReason: denial.denialReason,
      reviewedByAdminId: denial.reviewedByAdminId,
      reviewedAt: denial.reviewedAt,
      denialEmailSentAt: null,
    },
  })
}

export async function markSubmissionRefundReserved(id: string, denial: Denial): Promise<number> {
  const result = await prisma.submission.updateMany({
    where: {
      id,
      status: {
        in: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
      },
      stripeRefundId: null,
    },
    data: {
      status: SubmissionStatus.DENIED,
      denialReason: denial.denialReason,
      reviewedByAdminId: denial.reviewedByAdminId,
      reviewedAt: denial.reviewedAt,
      stripeRefundId: `pending_${id}`,
      refundedAt: denial.reviewedAt,
    },
  })
  return result.count
}

export async function releaseSubmissionRefundReservation(id: string): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.PENDING_REVIEW,
      stripeRefundId: null,
      reviewedByAdminId: null,
      reviewedAt: null,
      refundedAt: null,
      denialReason: null,
    },
  })
}

export async function recordSubmissionRefund(id: string, stripeRefundId: string): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      stripeRefundId,
    },
  })
}

export async function returnSubmissionToReview(id: string, updatedAt: Date): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      status: SubmissionStatus.PENDING_REVIEW,
      reviewedByAdminId: null,
      reviewedAt: null,
      updatedAt,
    },
  })
}

export async function removeSubmissionGuardian(id: string, updatedAt: Date): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      recipient: 'myself',
      guardianFirstName: null,
      guardianLastName: null,
      guardianDateOfBirth: null,
      updatedAt,
    },
  })
}

export async function updateSubmissionDetails(
  id: string,
  patch: SubmissionDetailsPatch,
  updatedAt: Date
): Promise<void> {
  await prisma.submission.update({
    where: { id },
    data: {
      ...patch,
      updatedAt,
    },
  })
}

export async function updatePendingSubmissionClassification(
  id: string,
  classification: ReviewClassification,
  updatedAt: Date
): Promise<number> {
  const result = await prisma.submission.updateMany({
    where: {
      id,
      status: SubmissionStatus.PENDING_REVIEW,
    },
    data: {
      ...classification,
      updatedAt,
    },
  })
  return result.count
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

export async function insertSubmission(submission: SubmissionInsert): Promise<Submission> {
  const { attribution, symptoms, ...columns } = submission
  return prisma.submission.create({
    data: {
      ...columns,
      attribution: attribution as Prisma.InputJsonValue | undefined,
      symptoms: symptoms as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function findSubmissionIdForPaymentIntent(
  stripePaymentIntentId: string
): Promise<Pick<Submission, 'id'> | null> {
  return prisma.submission.findUnique({
    where: { stripePaymentIntentId },
    select: { id: true },
  })
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const FOLLOW_UP_MIN_AGE_DAYS = 5
const FOLLOW_UP_MAX_AGE_DAYS = 7
const CLAIM_TIMEOUT_MS = 30 * 60 * 1000
const FOLLOW_UP_BATCH_SIZE = 100

function dueFollowUpEmailWhere(now: Date): Prisma.SubmissionWhereInput {
  return {
    status: SubmissionStatus.APPROVED,
    approvalEmailSentAt: { not: null },
    followUpEmailSentAt: null,
    createdAt: {
      gte: new Date(now.getTime() - FOLLOW_UP_MAX_AGE_DAYS * MS_PER_DAY),
      lte: new Date(now.getTime() - FOLLOW_UP_MIN_AGE_DAYS * MS_PER_DAY),
    },
    OR: [
      { followUpEmailClaimedAt: null },
      { followUpEmailClaimedAt: { lte: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
    ],
  }
}

export async function findDueFollowUpEmails(
  now: Date
): Promise<
  Pick<Submission, 'id' | 'email' | 'patientFirstName' | 'patientLastName' | 'notePurpose'>[]
> {
  return prisma.submission.findMany({
    where: dueFollowUpEmailWhere(now),
    orderBy: { createdAt: 'asc' },
    take: FOLLOW_UP_BATCH_SIZE,
    select: {
      id: true,
      email: true,
      patientFirstName: true,
      patientLastName: true,
      notePurpose: true,
    },
  })
}

export async function claimDueFollowUpEmail(id: string, now: Date): Promise<number> {
  const claim = await prisma.submission.updateMany({
    where: {
      id,
      ...dueFollowUpEmailWhere(now),
    },
    data: { followUpEmailClaimedAt: now },
  })
  return claim.count
}

export async function releaseFollowUpEmailClaimAt(id: string, claimedAt: Date): Promise<void> {
  await prisma.submission.updateMany({
    where: {
      id,
      followUpEmailSentAt: null,
      followUpEmailClaimedAt: claimedAt,
    },
    data: { followUpEmailClaimedAt: null },
  })
}

export async function acknowledgeFollowUpEmailSent(id: string, claimedAt: Date): Promise<number> {
  const acknowledgement = await prisma.submission.updateMany({
    where: {
      id,
      followUpEmailSentAt: null,
      followUpEmailClaimedAt: claimedAt,
    },
    data: {
      followUpEmailClaimedAt: null,
      followUpEmailSentAt: claimedAt,
    },
  })
  return acknowledgement.count
}

export async function findLatestSubmission(): Promise<Submission | null> {
  return prisma.submission.findFirst({
    orderBy: { createdAt: 'desc' },
  })
}

export async function findApprovedSubmissionsForEmail(email: string): Promise<Submission[]> {
  return prisma.submission.findMany({
    where: {
      email,
      status: SubmissionStatus.APPROVED,
    },
    orderBy: {
      reviewedAt: 'desc',
    },
  })
}

export async function findApprovedSubmissionsMissingApprovalEmail(): Promise<Submission[]> {
  return prisma.submission.findMany({
    where: {
      status: SubmissionStatus.APPROVED,
      approvalEmailSentAt: null,
    },
    orderBy: {
      reviewedAt: 'desc',
    },
  })
}

export async function countSubmissions(): Promise<number> {
  return prisma.submission.count()
}

export async function findRecentSubmissions(): Promise<
  Pick<
    Submission,
    'id' | 'email' | 'status' | 'createdAt' | 'patientFirstName' | 'patientLastName'
  >[]
> {
  return prisma.submission.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
      patientFirstName: true,
      patientLastName: true,
    },
  })
}

export async function countSubmissionsByStatus(): Promise<
  { status: SubmissionStatus; _count: number }[]
> {
  const statusCounts = await prisma.submission.groupBy({
    by: ['status'],
    _count: true,
  })
  return statusCounts
}

export async function deleteSubmissionById(id: string): Promise<void> {
  await prisma.submission.delete({
    where: { id },
  })
}

export async function deleteAllSubmissions(): Promise<number> {
  const result = await prisma.submission.deleteMany({})
  return result.count
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
  return prisma.submission.findFirst({
    where: { smsPhoneE164 },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
}

export async function countSmsOptedInSubmissionsForPhone(smsPhoneE164: string): Promise<number> {
  return prisma.submission.count({
    where: {
      smsPhoneE164,
      smsOptIn: true,
    },
  })
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
  return prisma.submission.findMany({
    where: { email },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      email: true,
      phone: true,
      smsOptIn: true,
      smsPhoneE164: true,
      status: true,
    },
  })
}

export async function findSubmissionForSupportTicket(
  id: string
): Promise<Pick<
  Submission,
  'id' | 'smsOptIn' | 'smsPhoneE164' | 'patientFirstName' | 'patientLastName'
> | null> {
  return prisma.submission.findUnique({
    where: { id },
    select: {
      id: true,
      smsOptIn: true,
      smsPhoneE164: true,
      patientFirstName: true,
      patientLastName: true,
    },
  })
}

export async function findSmsSupportSubmissionCandidatesForPhone(phoneE164: string): Promise<
  (Pick<Submission, 'id' | 'status'> & {
    smsMessages: Pick<SmsMessage, 'id'>[]
  })[]
> {
  return prisma.submission.findMany({
    where: {
      smsPhoneE164: phoneE164,
      smsOptIn: true,
    },
    select: {
      id: true,
      status: true,
      smsMessages: {
        where: {
          direction: 'outbound',
          to: phoneE164,
          sentAt: { not: null },
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findApprovedSubmissionIdForSupportTicket(
  id: string
): Promise<Pick<Submission, 'id'> | null> {
  return prisma.submission.findFirst({
    where: {
      id,
      status: SubmissionStatus.APPROVED,
    },
    select: { id: true },
  })
}

export async function findLatestApprovedSubmissionIdsForSupportPhone(
  smsPhoneE164: string
): Promise<Pick<Submission, 'id'>[]> {
  return prisma.submission.findMany({
    where: {
      smsPhoneE164,
      status: SubmissionStatus.APPROVED,
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 2,
  })
}

export async function findApprovedSupportSubmissionIdsByReference(
  smsPhoneE164: string,
  { idPrefix, medicalRecordNumber }: { idPrefix?: string; medicalRecordNumber?: string }
): Promise<Pick<Submission, 'id'>[]> {
  const supportReferenceFilters: Prisma.SubmissionWhereInput[] = []
  if (idPrefix !== undefined) {
    supportReferenceFilters.push({ id: { startsWith: idPrefix } })
  }
  if (medicalRecordNumber !== undefined) {
    supportReferenceFilters.push({
      noteVerifications: { some: { medicalRecordNumber } },
    })
  }

  return prisma.submission.findMany({
    where: {
      smsPhoneE164,
      status: SubmissionStatus.APPROVED,
      OR: supportReferenceFilters,
    },
    select: { id: true },
    take: 2,
  })
}

export async function findApprovedSubmissionBirthDateForSupport(
  id: string
): Promise<Pick<Submission, 'id' | 'patientDateOfBirth'> | null> {
  return prisma.submission.findFirst({
    where: {
      id,
      status: SubmissionStatus.APPROVED,
    },
    select: {
      id: true,
      patientDateOfBirth: true,
    },
  })
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
  return prisma.$transaction(async (tx) => {
    const ticketGuard = await tx.smsSupportTicket.updateMany({
      where: {
        id: ticketId,
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
      },
      data: {
        failureReason: null,
      },
    })

    if (ticketGuard.count !== 1) return 'cancelled' as const

    const jobGuard = await tx.smsSupportJob.updateMany({
      where: {
        id: jobId,
        status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      },
      data: {
        status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
        lockedAt: committedAt,
      },
    })

    if (jobGuard.count !== 1) return 'cancelled' as const

    const submissionUpdate = await tx.submission.updateMany({
      where: {
        id: submissionId,
        status: SubmissionStatus.APPROVED,
        updatedAt: submissionUpdatedAt,
      },
      data: updateData,
    })

    if (submissionUpdate.count !== 1) return 'submission_changed' as const

    return 'updated' as const
  })
}
