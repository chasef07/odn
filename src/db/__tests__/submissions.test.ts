import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { SubmissionStatus } from '../types'

const {
  mockSubmissionCreate,
  mockSubmissionFindUnique,
  mockSubmissionFindFirst,
  mockSubmissionFindMany,
  mockSubmissionCount,
  mockSubmissionGroupBy,
  mockSubmissionUpdate,
  mockSubmissionUpdateMany,
  mockSubmissionDelete,
  mockSubmissionDeleteMany,
  mockTicketUpdateMany,
  mockJobUpdateMany,
} = vi.hoisted(() => ({
  mockSubmissionCreate: vi.fn(),
  mockSubmissionFindUnique: vi.fn(),
  mockSubmissionFindFirst: vi.fn(),
  mockSubmissionFindMany: vi.fn(),
  mockSubmissionCount: vi.fn(),
  mockSubmissionGroupBy: vi.fn(),
  mockSubmissionUpdate: vi.fn(),
  mockSubmissionUpdateMany: vi.fn(),
  mockSubmissionDelete: vi.fn(),
  mockSubmissionDeleteMany: vi.fn(),
  mockTicketUpdateMany: vi.fn(),
  mockJobUpdateMany: vi.fn(),
}))

vi.mock('../client', () => {
  const client = {
    submission: {
      create: mockSubmissionCreate,
      findUnique: mockSubmissionFindUnique,
      findFirst: mockSubmissionFindFirst,
      findMany: mockSubmissionFindMany,
      count: mockSubmissionCount,
      groupBy: mockSubmissionGroupBy,
      update: mockSubmissionUpdate,
      updateMany: mockSubmissionUpdateMany,
      delete: mockSubmissionDelete,
      deleteMany: mockSubmissionDeleteMany,
    },
    smsSupportTicket: { updateMany: mockTicketUpdateMany },
    smsSupportJob: { updateMany: mockJobUpdateMany },
  }
  return {
    default: {
      ...client,
      $transaction: (callback: (tx: unknown) => unknown) => callback(client),
    },
  }
})

import {
  acknowledgeFollowUpEmailSent,
  approveManualSubmission,
  approveReviewableSubmission,
  claimDueFollowUpEmail,
  commitSupportAutomationSubmissionUpdate,
  countSmsOptedInSubmissionsForPhone,
  countSubmissions,
  countSubmissionsByStatus,
  deleteAllSubmissions,
  deleteSubmissionById,
  findApprovedSubmissionsForEmail,
  findApprovedSubmissionsMissingApprovalEmail,
  findApprovedSubmissionsOverlapping,
  findApprovedSupportSubmissionIdsByReference,
  findDueFollowUpEmails,
  findLatestSubmission,
  findLatestSubmissionIdForInboundSmsPhone,
  findLatestSubmissionsForBouncedEmail,
  findRecentSubmissions,
  findSmsSupportSubmissionCandidatesForPhone,
  findSubmissionById,
  findSubmissionForSupportTicket,
  findSubmissionIdForPaymentIntent,
  insertSubmission,
  markPendingSubmissionMaybe,
  markSubmissionMaybe,
  markSubmissionRefundReserved,
  reapproveSubmission,
  recordApprovalEmailSent,
  recordDenialEmailSent,
  recordMaybeEmailSent,
  recordSubmissionRefund,
  releaseFollowUpEmailClaimAt,
  releaseSubmissionRefundReservation,
  removeSubmissionGuardian,
  searchSubmissionsPage,
  updatePendingSubmissionClassification,
  updateSubmissionDetails,
  type SubmissionInsert,
} from '../submissions'

beforeEach(() => {
  vi.clearAllMocks()
})

const submissionId = 'sub_123'
const doctorId = 'doctor_123'
const now = new Date('2026-06-01T12:00:00.000Z')

describe('submission queries', () => {
  beforeEach(() => {
    mockSubmissionUpdate.mockResolvedValue({})
  })

  it('finds a submission by id', async () => {
    mockSubmissionFindUnique.mockResolvedValue(null)

    await findSubmissionById(submissionId)

    expect(mockSubmissionFindUnique).toHaveBeenCalledWith({
      where: { id: submissionId },
    })
  })

  it('searches submissions by Medical Record # with the same filter for rows and total', async () => {
    mockSubmissionFindMany.mockResolvedValue([])
    mockSubmissionCount.mockResolvedValue(1)

    const result = await searchSubmissionsPage(
      { by: 'medicalRecordNumber', medicalRecordNumber: 'FAT5YHAB' },
      { skip: 0, take: 10 }
    )

    const expectedWhere = {
      noteVerifications: {
        some: {
          medicalRecordNumber: 'FAT5YHAB',
        },
      },
    }

    expect(mockSubmissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      })
    )
    expect(mockSubmissionCount).toHaveBeenCalledWith({ where: expectedWhere })
    expect(result).toEqual({ submissions: [], total: 1 })
  })

  it('finds approved submissions overlapping the window by case-insensitive patient identity', async () => {
    mockSubmissionFindMany.mockResolvedValue([])
    const dob = new Date('1990-05-15')
    const windowStart = new Date('2024-12-16T00:00:00.000Z')
    const windowEnd = new Date('2025-01-14T00:00:00.000Z')

    await findApprovedSubmissionsOverlapping(
      { patientFirstName: 'JOHN', patientLastName: 'DOE', patientDateOfBirth: dob },
      { windowStart, windowEnd }
    )

    expect(mockSubmissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientFirstName: { equals: 'JOHN', mode: 'insensitive' },
          patientLastName: { equals: 'DOE', mode: 'insensitive' },
          patientDateOfBirth: dob,
          status: SubmissionStatus.APPROVED,
          firstDayOff: { lte: windowEnd },
          lastDayOff: { gte: windowStart },
        }),
      })
    )
  })
})

describe('submission edits', () => {
  beforeEach(() => {
    mockSubmissionUpdate.mockResolvedValue({})
  })

  it('writes the edited details with the update timestamp', async () => {
    await updateSubmissionDetails(
      submissionId,
      {
        phone: '(555) 987-6543',
        smsOptIn: false,
        smsOptInAt: null,
        smsConsentVersion: null,
        smsPhoneE164: null,
      },
      now
    )

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: {
        phone: '(555) 987-6543',
        smsOptIn: false,
        smsOptInAt: null,
        smsConsentVersion: null,
        smsPhoneE164: null,
        updatedAt: now,
      },
    })
  })

  it('updates classification only for pending review submissions', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })

    const count = await updatePendingSubmissionClassification(
      submissionId,
      {
        notePurpose: 'school',
        otherNotePurpose: null,
        absenceReason: 'Illness',
        otherAbsenceReason: null,
      },
      now
    )

    expect(count).toBe(1)
    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: submissionId,
        status: SubmissionStatus.PENDING_REVIEW,
      },
      data: {
        notePurpose: 'school',
        otherNotePurpose: null,
        absenceReason: 'Illness',
        otherAbsenceReason: null,
        updatedAt: now,
      },
    })
  })

  it('clears guardian mode', async () => {
    await removeSubmissionGuardian(submissionId, now)

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: {
        recipient: 'myself',
        guardianFirstName: null,
        guardianLastName: null,
        guardianDateOfBirth: null,
        updatedAt: now,
      },
    })
  })
})

describe('submission denial writes', () => {
  beforeEach(() => {
    mockSubmissionUpdate.mockResolvedValue({})
  })

  it('reserves the refund only while the submission is reviewable and unrefunded', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })

    const count = await markSubmissionRefundReserved(submissionId, {
      denialReason: 'Legal',
      reviewedByAdminId: doctorId,
      reviewedAt: now,
    })

    expect(count).toBe(1)
    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: submissionId,
        status: { in: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE] },
        stripeRefundId: null,
      },
      data: {
        status: SubmissionStatus.DENIED,
        denialReason: 'Legal',
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        stripeRefundId: `pending_${submissionId}`,
        refundedAt: now,
      },
    })
  })

  it('returns the reserved submission to review when the refund fails', async () => {
    await releaseSubmissionRefundReservation(submissionId)

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.PENDING_REVIEW,
        stripeRefundId: null,
        reviewedByAdminId: null,
        reviewedAt: null,
        refundedAt: null,
        denialReason: null,
      },
    })
  })

  it('records the Stripe refund id', async () => {
    await recordSubmissionRefund(submissionId, 're_test_123')

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: { stripeRefundId: 're_test_123' },
    })
  })

  it('records the denial email timestamp', async () => {
    await recordDenialEmailSent(submissionId, now)

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: { denialEmailSentAt: now },
    })
  })
})

describe('submission maybe writes', () => {
  const maybeReview = {
    maybeReason: 'DATES_EXCEED_ALLOWED_RANGE',
    maybeInternalNote: 'Review date range',
    maybeApprovedDays: 3,
    reviewedByAdminId: doctorId,
    reviewedAt: now,
  }

  beforeEach(() => {
    mockSubmissionUpdate.mockResolvedValue({})
  })

  it('moves a pending submission to maybe only while it is still pending', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })

    const count = await markPendingSubmissionMaybe(submissionId, maybeReview)

    expect(count).toBe(1)
    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: submissionId,
        status: SubmissionStatus.PENDING_REVIEW,
      },
      data: {
        status: SubmissionStatus.MAYBE,
        maybeReason: 'DATES_EXCEED_ALLOWED_RANGE',
        maybeInternalNote: 'Review date range',
        maybeApprovedDays: 3,
        maybeEmailSentAt: null,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        updatedAt: now,
      },
    })
    expect(mockSubmissionUpdateMany.mock.calls[0][0].data).not.toHaveProperty(
      'additionalInformation'
    )
  })

  it('moves a non-pending submission to maybe without a status guard', async () => {
    await markSubmissionMaybe(submissionId, {
      ...maybeReview,
      maybeReason: 'OTHER_REVIEW',
      maybeApprovedDays: null,
    })

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: expect.objectContaining({
        status: SubmissionStatus.MAYBE,
        maybeReason: 'OTHER_REVIEW',
        maybeApprovedDays: null,
        maybeEmailSentAt: null,
      }),
    })
  })

  it('records the maybe email timestamp', async () => {
    await recordMaybeEmailSent(submissionId, now)

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: { maybeEmailSentAt: now },
    })
  })
})

describe('submission approval writes', () => {
  beforeEach(() => {
    mockSubmissionUpdate.mockResolvedValue({})
  })

  it('approves only pending or maybe submissions and clears a stale denial reason', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })

    const count = await approveReviewableSubmission(submissionId, {
      reviewedByAdminId: doctorId,
      reviewedAt: now,
      approvalDiagnosis: null,
      approvalWithRestrictions: true,
    })

    expect(count).toBe(1)
    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: submissionId,
        status: {
          in: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
        },
      },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        denialReason: null,
        approvalDiagnosis: null,
        approvalWithRestrictions: true,
      },
    })
  })

  it('approves a manual submission and clears stale approval and denial fields', async () => {
    await approveManualSubmission(submissionId, { reviewedByAdminId: doctorId, reviewedAt: now })

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        denialReason: null,
        approvalEmailSentAt: null,
        approvalDiagnosis: null,
        approvalWithRestrictions: null,
      },
    })
  })

  it('re-approves only the approved submission version that was read', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 0 })
    const expectedUpdatedAt = new Date('2024-01-10')

    const count = await reapproveSubmission(submissionId, expectedUpdatedAt, {
      reviewedByAdminId: doctorId,
      reviewedAt: now,
      approvalDiagnosis: 'flu',
      approvalWithRestrictions: true,
    })

    expect(count).toBe(0)
    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: submissionId,
        status: SubmissionStatus.APPROVED,
        updatedAt: expectedUpdatedAt,
      },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        denialReason: null,
        approvalDiagnosis: 'flu',
        approvalWithRestrictions: true,
        updatedAt: now,
      },
    })
  })

  it('records the approval email timestamp', async () => {
    await recordApprovalEmailSent(submissionId, now)

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: submissionId },
      data: { approvalEmailSentAt: now },
    })
  })
})

describe('intake submission queries', () => {
  const intakeNow = new Date('2026-08-23T12:00:00.000Z')

  const dueFollowUpWhere = {
    status: SubmissionStatus.APPROVED,
    approvalEmailSentAt: { not: null },
    followUpEmailSentAt: null,
    createdAt: {
      gte: new Date('2026-08-16T12:00:00.000Z'),
      lte: new Date('2026-08-18T12:00:00.000Z'),
    },
    OR: [
      { followUpEmailClaimedAt: null },
      { followUpEmailClaimedAt: { lte: new Date('2026-08-23T11:30:00.000Z') } },
    ],
  }

  it('inserts the submission row with its JSON columns as given', async () => {
    const created = { id: 'sub_1' }
    mockSubmissionCreate.mockResolvedValue(created)
    const row: SubmissionInsert = {
      stripePaymentIntentId: 'pi_123',
      paymentAmount: 2495,
      status: SubmissionStatus.MAYBE,
      denialReason: null,
      attribution: { last: { channel: 'reddit' } },
      symptoms: ['Fever', 'Cough'],
      state: 'CA',
      recipient: 'myself',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      patientDateOfBirth: new Date('1990-01-01'),
      email: 'john@example.com',
      phone: '5551234567',
      notePurpose: 'work',
      firstDayOff: new Date('2026-08-22'),
      lastDayOff: new Date('2026-08-24'),
      absenceReason: 'illness',
    }

    await expect(insertSubmission(row)).resolves.toBe(created)

    expect(mockSubmissionCreate).toHaveBeenCalledWith({ data: row })
  })

  it('leaves absent JSON columns undefined so Prisma omits them', async () => {
    mockSubmissionCreate.mockResolvedValue({ id: 'sub_2' })

    await insertSubmission({
      stripePaymentIntentId: 'pi_456',
      attribution: undefined,
      symptoms: undefined,
      state: 'CA',
      recipient: 'myself',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      patientDateOfBirth: new Date('1990-01-01'),
      email: 'john@example.com',
      phone: '5551234567',
      notePurpose: 'work',
      firstDayOff: new Date('2026-08-22'),
      lastDayOff: new Date('2026-08-24'),
      absenceReason: 'illness',
    })

    const data = mockSubmissionCreate.mock.calls[0][0].data
    expect(data.attribution).toBeUndefined()
    expect(data.symptoms).toBeUndefined()
  })

  it('finds only the id of the submission for a payment intent', async () => {
    mockSubmissionFindUnique.mockResolvedValue({ id: 'sub_existing' })

    await expect(findSubmissionIdForPaymentIntent('pi_123')).resolves.toEqual({
      id: 'sub_existing',
    })

    expect(mockSubmissionFindUnique).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_123' },
      select: { id: true },
    })
  })

  it('selects only delivered approved notes purchased 5-7 days ago for follow-up', async () => {
    mockSubmissionFindMany.mockResolvedValue([])

    await expect(findDueFollowUpEmails(intakeNow)).resolves.toEqual([])

    expect(mockSubmissionFindMany).toHaveBeenCalledWith({
      where: dueFollowUpWhere,
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        email: true,
        patientFirstName: true,
        patientLastName: true,
        notePurpose: true,
      },
    })
  })

  it('claims a follow-up only while the submission is still due and reports the claimed count', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })

    await expect(claimDueFollowUpEmail('sub_123', intakeNow)).resolves.toBe(1)

    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'sub_123',
        ...dueFollowUpWhere,
      },
      data: { followUpEmailClaimedAt: intakeNow },
    })
  })

  it('reports zero when another invocation already holds the claim', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 0 })

    await expect(claimDueFollowUpEmail('sub_123', intakeNow)).resolves.toBe(0)
  })

  it('releases only the claim this run holds', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })

    await expect(releaseFollowUpEmailClaimAt('sub_123', intakeNow)).resolves.toBeUndefined()

    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'sub_123',
        followUpEmailSentAt: null,
        followUpEmailClaimedAt: intakeNow,
      },
      data: { followUpEmailClaimedAt: null },
    })
  })

  it('records the follow-up as sent under the held claim and reports the count', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })

    await expect(acknowledgeFollowUpEmailSent('sub_123', intakeNow)).resolves.toBe(1)

    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'sub_123',
        followUpEmailSentAt: null,
        followUpEmailClaimedAt: intakeNow,
      },
      data: {
        followUpEmailClaimedAt: null,
        followUpEmailSentAt: intakeNow,
      },
    })
  })

  it('finds a full submission by id', async () => {
    mockSubmissionFindUnique.mockResolvedValue(null)

    await expect(findSubmissionById('sub_123')).resolves.toBeNull()

    expect(mockSubmissionFindUnique).toHaveBeenCalledWith({ where: { id: 'sub_123' } })
  })

  it('finds the newest submission', async () => {
    mockSubmissionFindFirst.mockResolvedValue(null)

    await expect(findLatestSubmission()).resolves.toBeNull()

    expect(mockSubmissionFindFirst).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } })
  })

  it('finds approved submissions for an email, most recently reviewed first', async () => {
    mockSubmissionFindMany.mockResolvedValue([])

    await expect(findApprovedSubmissionsForEmail('patient@example.com')).resolves.toEqual([])

    expect(mockSubmissionFindMany).toHaveBeenCalledWith({
      where: {
        email: 'patient@example.com',
        status: 'APPROVED',
      },
      orderBy: {
        reviewedAt: 'desc',
      },
    })
  })

  it('finds approved submissions that never got an approval email', async () => {
    mockSubmissionFindMany.mockResolvedValue([])

    await expect(findApprovedSubmissionsMissingApprovalEmail()).resolves.toEqual([])

    expect(mockSubmissionFindMany).toHaveBeenCalledWith({
      where: {
        status: 'APPROVED',
        approvalEmailSentAt: null,
      },
      orderBy: {
        reviewedAt: 'desc',
      },
    })
  })

  it('stamps the approval email send time', async () => {
    mockSubmissionUpdate.mockResolvedValue({ id: 'sub_123' })
    const sentAt = new Date('2026-08-23T12:00:00.000Z')

    await expect(recordApprovalEmailSent('sub_123', sentAt)).resolves.toBeUndefined()

    expect(mockSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub_123' },
      data: {
        approvalEmailSentAt: sentAt,
      },
    })
  })

  it('counts every submission', async () => {
    mockSubmissionCount.mockResolvedValue(12)

    await expect(countSubmissions()).resolves.toBe(12)

    expect(mockSubmissionCount).toHaveBeenCalledWith()
  })

  it('lists the five newest submissions with summary columns', async () => {
    mockSubmissionFindMany.mockResolvedValue([])

    await expect(findRecentSubmissions()).resolves.toEqual([])

    expect(mockSubmissionFindMany).toHaveBeenCalledWith({
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
  })

  it('counts submissions per status', async () => {
    const counts = [{ status: 'APPROVED', _count: 4 }]
    mockSubmissionGroupBy.mockResolvedValue(counts)

    await expect(countSubmissionsByStatus()).resolves.toBe(counts)

    expect(mockSubmissionGroupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: true,
    })
  })

  it('deletes one submission by id', async () => {
    mockSubmissionDelete.mockResolvedValue({ id: 'sub_123' })

    await expect(deleteSubmissionById('sub_123')).resolves.toBeUndefined()

    expect(mockSubmissionDelete).toHaveBeenCalledWith({ where: { id: 'sub_123' } })
  })

  it('deletes every submission and reports how many', async () => {
    mockSubmissionDeleteMany.mockResolvedValue({ count: 10 })

    await expect(deleteAllSubmissions()).resolves.toBe(10)

    expect(mockSubmissionDeleteMany).toHaveBeenCalledWith({})
  })
})

describe('sms support submission queries', () => {
  describe('findLatestSubmissionsForBouncedEmail', () => {
    it('reads the two latest submissions for the bounced email', async () => {
      const submissions = [{ id: 'sub_123' }]
      mockSubmissionFindMany.mockResolvedValue(submissions)

      await expect(findLatestSubmissionsForBouncedEmail('john@example.com')).resolves.toEqual(
        submissions
      )
      expect(mockSubmissionFindMany).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
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
    })
  })

  describe('findLatestSubmissionIdForInboundSmsPhone', () => {
    it('reads the id of the newest submission for the phone', async () => {
      mockSubmissionFindFirst.mockResolvedValue({ id: 'sub_123' })

      await expect(findLatestSubmissionIdForInboundSmsPhone('+15551234567')).resolves.toEqual({
        id: 'sub_123',
      })
      expect(mockSubmissionFindFirst).toHaveBeenCalledWith({
        where: { smsPhoneE164: '+15551234567' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
    })
  })

  describe('countSmsOptedInSubmissionsForPhone', () => {
    it('counts opted-in submissions for the phone', async () => {
      mockSubmissionCount.mockResolvedValue(2)

      await expect(countSmsOptedInSubmissionsForPhone('+15551234567')).resolves.toBe(2)
      expect(mockSubmissionCount).toHaveBeenCalledWith({
        where: {
          smsPhoneE164: '+15551234567',
          smsOptIn: true,
        },
      })
    })
  })

  describe('findSubmissionForSupportTicket', () => {
    it('reads the SMS contact fields of the submission', async () => {
      mockSubmissionFindUnique.mockResolvedValue(null)

      await expect(findSubmissionForSupportTicket('sub_123')).resolves.toBeNull()
      expect(mockSubmissionFindUnique).toHaveBeenCalledWith({
        where: { id: 'sub_123' },
        select: {
          id: true,
          smsOptIn: true,
          smsPhoneE164: true,
          patientFirstName: true,
          patientLastName: true,
        },
      })
    })
  })

  describe('findSmsSupportSubmissionCandidatesForPhone', () => {
    it('finds opted-in submissions for the phone with their sent outbound SMS', async () => {
      mockSubmissionFindMany.mockResolvedValue([])

      await findSmsSupportSubmissionCandidatesForPhone('+15551234567')

      expect(mockSubmissionFindMany).toHaveBeenCalledWith({
        where: {
          smsPhoneE164: '+15551234567',
          smsOptIn: true,
        },
        select: {
          id: true,
          status: true,
          smsMessages: {
            where: {
              direction: 'outbound',
              to: '+15551234567',
              sentAt: { not: null },
            },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('does not treat a failed outbound SMS as conversation evidence', async () => {
      mockSubmissionFindMany.mockImplementation(
        async (query: { select?: { smsMessages?: { where?: { sentAt?: { not?: null } } } } }) => {
          const excludesUnsentMessages = query.select?.smsMessages?.where?.sentAt?.not === null
          return [
            {
              id: 'sub_pending',
              status: 'PENDING_REVIEW',
              smsMessages: excludesUnsentMessages ? [] : [{ id: 'sms_sending_failed' }],
            },
            { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
          ]
        }
      )

      const candidates = await findSmsSupportSubmissionCandidatesForPhone('+15551234567')

      expect(candidates).toEqual([
        { id: 'sub_pending', status: 'PENDING_REVIEW', smsMessages: [] },
        { id: 'sub_denied', status: 'DENIED', smsMessages: [] },
      ])
    })
  })

  describe('findApprovedSupportSubmissionIdsByReference', () => {
    it('matches approved submissions for the phone by id prefix or medical record number', async () => {
      mockSubmissionFindMany.mockResolvedValue([{ id: 'abc12345-submission' }])

      await findApprovedSupportSubmissionIdsByReference('+15551234567', {
        idPrefix: 'abc12345',
        medicalRecordNumber: 'ABC12345',
      })

      expect(mockSubmissionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            smsPhoneE164: '+15551234567',
            status: 'APPROVED',
            OR: expect.arrayContaining([
              { id: { startsWith: 'abc12345' } },
              { noteVerifications: { some: { medicalRecordNumber: 'ABC12345' } } },
            ]),
          }),
        })
      )
    })
  })
})

describe('commitSupportAutomationSubmissionUpdate', () => {
  const committedAt = new Date('2026-06-29T12:00:00Z')
  const submissionUpdatedAt = new Date('2026-06-20T00:00:00Z')
  const updateData = {
    denialReason: null,
    reviewedAt: committedAt,
    updatedAt: committedAt,
    notePurpose: 'school',
    otherNotePurpose: null,
  }

  function commit() {
    return commitSupportAutomationSubmissionUpdate({
      ticketId: 'ticket_123',
      jobId: 'job_123',
      submissionId: 'sub_123',
      submissionUpdatedAt,
      committedAt,
      updateData,
    })
  }

  beforeEach(() => {
    mockTicketUpdateMany.mockResolvedValue({ count: 1 })
    mockJobUpdateMany.mockResolvedValue({ count: 1 })
    mockSubmissionUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('guards the ticket, then the job, then updates the unchanged approved submission', async () => {
    await expect(commit()).resolves.toBe('updated')

    expect(mockTicketUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'ticket_123',
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
      },
      data: {
        failureReason: null,
      },
    })
    expect(mockJobUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'job_123',
        status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      },
      data: {
        status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
        lockedAt: committedAt,
      },
    })
    expect(mockSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'sub_123',
        status: SubmissionStatus.APPROVED,
        updatedAt: submissionUpdatedAt,
      },
      data: updateData,
    })
    expect(mockTicketUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockJobUpdateMany.mock.invocationCallOrder[0]
    )
    expect(mockJobUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubmissionUpdateMany.mock.invocationCallOrder[0]
    )
  })

  it('returns cancelled without touching the job or submission when the ticket left automation', async () => {
    mockTicketUpdateMany.mockResolvedValue({ count: 0 })

    await expect(commit()).resolves.toBe('cancelled')

    expect(mockJobUpdateMany).not.toHaveBeenCalled()
    expect(mockSubmissionUpdateMany).not.toHaveBeenCalled()
  })

  it('returns cancelled without updating the submission when the job guard loses the cancellation race', async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 0 })

    await expect(commit()).resolves.toBe('cancelled')

    expect(mockTicketUpdateMany).toHaveBeenCalledTimes(1)
    expect(mockSubmissionUpdateMany).not.toHaveBeenCalled()
  })

  it('returns submission_changed when the submission changed since it was read', async () => {
    mockSubmissionUpdateMany.mockResolvedValue({ count: 0 })

    await expect(commit()).resolves.toBe('submission_changed')
  })
})
