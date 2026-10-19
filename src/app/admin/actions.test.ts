import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SubmissionStatus } from '@/db/types'

const {
  mockRefundsCreate,
  mockFindSubmissionById,
  mockFindSubmissionForDenial,
  mockFindSubmissionSmsContact,
  mockSearchSubmissionsPage,
  mockUpdateSubmissionDetails,
  mockUpdatePendingSubmissionClassification,
  mockMarkSubmissionRefundReserved,
  mockReleaseSubmissionRefundReservation,
  mockRecordSubmissionRefund,
  mockRecordDenialEmailSent,
  mockMarkSubmissionDeniedAndRefunded,
  mockMarkSubmissionDenied,
  mockMarkPendingSubmissionMaybe,
  mockMarkSubmissionMaybe,
  mockRecordMaybeEmailSent,
  mockFindSubmissionIdsByStatus,
  mockFindSupportTicketIdsByStatus,
  mockSendDenialEmail,
  mockSendMaybeEmail,
  mockSendTransactionalSmsForSubmission,
  mockNormalizeMedicalRecordNumber,
  mockRevokeNoteVerificationForSubmission,
  mockGetSession,
} = vi.hoisted(() => ({
  mockRefundsCreate: vi.fn(),
  mockFindSubmissionById: vi.fn(),
  mockFindSubmissionForDenial: vi.fn(),
  mockFindSubmissionSmsContact: vi.fn(),
  mockSearchSubmissionsPage: vi.fn(),
  mockUpdateSubmissionDetails: vi.fn(),
  mockUpdatePendingSubmissionClassification: vi.fn(),
  mockMarkSubmissionRefundReserved: vi.fn(),
  mockReleaseSubmissionRefundReservation: vi.fn(),
  mockRecordSubmissionRefund: vi.fn(),
  mockRecordDenialEmailSent: vi.fn(),
  mockMarkSubmissionDeniedAndRefunded: vi.fn(),
  mockMarkSubmissionDenied: vi.fn(),
  mockMarkPendingSubmissionMaybe: vi.fn(),
  mockMarkSubmissionMaybe: vi.fn(),
  mockRecordMaybeEmailSent: vi.fn(),
  mockFindSubmissionIdsByStatus: vi.fn(),
  mockFindSupportTicketIdsByStatus: vi.fn(),
  mockSendDenialEmail: vi.fn(),
  mockSendMaybeEmail: vi.fn(),
  mockSendTransactionalSmsForSubmission: vi.fn(),
  mockNormalizeMedicalRecordNumber: vi.fn((input: string) =>
    input
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  ),
  mockRevokeNoteVerificationForSubmission: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      refunds = {
        create: mockRefundsCreate,
      }
    },
  }
})

vi.mock('@/db/submissions', () => ({
  findSubmissionById: mockFindSubmissionById,
  findSubmissionForDenial: mockFindSubmissionForDenial,
  findSubmissionSmsContact: mockFindSubmissionSmsContact,
  searchSubmissionsPage: mockSearchSubmissionsPage,
  updateSubmissionDetails: mockUpdateSubmissionDetails,
  updatePendingSubmissionClassification: mockUpdatePendingSubmissionClassification,
  markSubmissionRefundReserved: mockMarkSubmissionRefundReserved,
  releaseSubmissionRefundReservation: mockReleaseSubmissionRefundReservation,
  recordSubmissionRefund: mockRecordSubmissionRefund,
  recordDenialEmailSent: mockRecordDenialEmailSent,
  markSubmissionDeniedAndRefunded: mockMarkSubmissionDeniedAndRefunded,
  markSubmissionDenied: mockMarkSubmissionDenied,
  markPendingSubmissionMaybe: mockMarkPendingSubmissionMaybe,
  markSubmissionMaybe: mockMarkSubmissionMaybe,
  recordMaybeEmailSent: mockRecordMaybeEmailSent,
  findSubmissionIdsByStatus: mockFindSubmissionIdsByStatus,
}))

vi.mock('@/db/sms-support', () => ({
  findSmsPhoneOptOut: vi.fn(),
  findSupportTicketIdsByStatus: mockFindSupportTicketIdsByStatus,
}))

vi.mock('@/lib/email', () => ({
  sendDenialEmail: mockSendDenialEmail,
  sendMaybeEmail: mockSendMaybeEmail,
}))

vi.mock('@/lib/telnyx', () => ({
  sendTransactionalSmsForSubmission: mockSendTransactionalSmsForSubmission,
}))

vi.mock('@/lib/note-verification', () => ({
  createNoteVerification: vi.fn(),
  getVerificationUrl: vi.fn(),
  normalizeMedicalRecordNumber: mockNormalizeMedicalRecordNumber,
  parseIssueDateInput: vi.fn(),
}))

vi.mock('@/db/note-verifications', () => ({
  revokeNoteVerificationById: vi.fn(),
  revokeOtherNoteVerificationsForSubmission: vi.fn(),
  revokeNoteVerificationForSubmission: mockRevokeNoteVerificationForSubmission,
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

import { changeSubmissionStatus } from '@/app/admin/_actions/change-status'
import { denySubmission } from '@/app/admin/_actions/deny'
import { maybeSubmission } from '@/app/admin/_actions/maybe'
import { searchSubmissions } from '@/app/admin/_actions/search'
import { updateSubmission, updateReviewClassification } from '@/app/admin/_actions/edits'
import { getDashboardStats } from '@/app/admin/_actions/queues'

describe('getDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { id: 'doctor_123' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('counts each queue from the ids it finds', async () => {
    mockFindSubmissionIdsByStatus.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    mockFindSupportTicketIdsByStatus.mockResolvedValue([{ id: 't' }])

    await expect(getDashboardStats()).resolves.toEqual({
      success: true,
      data: {
        pendingCount: 2,
        approvedToday: 2,
        deniedToday: 2,
        maybeCount: 2,
        manualCount: 2,
        needsAdminSupportCount: 1,
      },
    })
  })

  it('fails instead of showing zero counts when a queue query fails', async () => {
    mockFindSubmissionIdsByStatus.mockRejectedValue(new Error('connection refused'))
    mockFindSupportTicketIdsByStatus.mockResolvedValue([])

    await expect(getDashboardStats()).resolves.toEqual({
      success: false,
      error: 'Failed to fetch dashboard stats',
    })
  })

  it('fails instead of showing zero support tickets when the ticket query fails', async () => {
    mockFindSubmissionIdsByStatus.mockResolvedValue([])
    mockFindSupportTicketIdsByStatus.mockRejectedValue(new Error('connection refused'))

    await expect(getDashboardStats()).resolves.toMatchObject({ success: false })
  })
})

describe('searchSubmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: 'doctor_123' },
    })
    mockSearchSubmissionsPage.mockResolvedValue({
      submissions: [
        {
          id: 'sub_123',
          patientFirstName: 'Jane',
          patientLastName: 'Doe',
          email: 'jane@example.com',
          status: SubmissionStatus.APPROVED,
          notePurpose: 'work',
          firstDayOff: new Date('2026-06-01T00:00:00.000Z'),
          lastDayOff: new Date('2026-06-02T00:00:00.000Z'),
          createdAt: new Date('2026-05-30T12:00:00.000Z'),
        },
      ],
      total: 1,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('searches submissions by normalized Medical Record #', async () => {
    const result = await searchSubmissions({
      query: ' fat5-yhab ',
      searchType: 'medicalRecord',
    })

    expect(mockNormalizeMedicalRecordNumber).toHaveBeenCalledWith('fat5-yhab')
    expect(mockSearchSubmissionsPage).toHaveBeenCalledWith(
      { by: 'medicalRecordNumber', medicalRecordNumber: 'FAT5YHAB' },
      { skip: 0, take: 10 }
    )
    expect(result).toMatchObject({
      success: true,
      total: 1,
      submissions: [
        expect.objectContaining({
          id: 'sub_123',
          patientFirstName: 'Jane',
          patientLastName: 'Doe',
        }),
      ],
    })
  })
})

describe('updateSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: 'doctor_123' },
    })
    mockUpdateSubmissionDetails.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('refuses a date before 1900 without writing', async () => {
    const result = await updateSubmission('sub_123', {
      firstDayOff: new Date('0050-11-01T00:00:00.000Z'),
    })

    expect(result).toEqual({ success: false, error: 'Every date must be 1900-01-01 or later.' })
    expect(mockUpdateSubmissionDetails).not.toHaveBeenCalled()
  })

  it('clears SMS consent when admins change the consented phone number', async () => {
    mockFindSubmissionSmsContact.mockResolvedValue({
      phone: '(555) 123-4567',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
    })

    const result = await updateSubmission('sub_123', {
      phone: '(555) 987-6543',
    })

    expect(result).toEqual({ success: true })
    expect(mockUpdateSubmissionDetails).toHaveBeenCalledWith(
      'sub_123',
      expect.objectContaining({
        phone: '(555) 987-6543',
        smsOptIn: false,
        smsOptInAt: null,
        smsConsentVersion: null,
        smsPhoneE164: null,
      }),
      expect.any(Date)
    )
  })

  it('keeps SMS consent when admins only reformat the same phone number', async () => {
    mockFindSubmissionSmsContact.mockResolvedValue({
      phone: '(555) 123-4567',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
    })

    const result = await updateSubmission('sub_123', {
      phone: '+1 555 123 4567',
    })

    expect(result).toEqual({ success: true })
    expect(mockUpdateSubmissionDetails).toHaveBeenCalledWith(
      'sub_123',
      expect.objectContaining({
        phone: '+1 555 123 4567',
        smsPhoneE164: '+15551234567',
      }),
      expect.any(Date)
    )
    expect(mockUpdateSubmissionDetails).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        smsOptIn: false,
      }),
      expect.anything()
    )
  })
})

describe('updateReviewClassification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: 'doctor_123' },
    })
  })

  it('updates classification only for pending review submissions', async () => {
    mockUpdatePendingSubmissionClassification.mockResolvedValue(1)

    const result = await updateReviewClassification('sub_123', {
      notePurpose: 'school',
      otherNotePurpose: null,
      absenceReason: 'Illness',
      otherAbsenceReason: null,
    })

    expect(result).toEqual({ success: true })
    expect(mockUpdatePendingSubmissionClassification).toHaveBeenCalledWith(
      'sub_123',
      {
        notePurpose: 'school',
        otherNotePurpose: null,
        absenceReason: 'Illness',
        otherAbsenceReason: null,
      },
      expect.any(Date)
    )
  })

  it('rejects classification updates once a submission leaves review', async () => {
    mockUpdatePendingSubmissionClassification.mockResolvedValue(0)

    const result = await updateReviewClassification('sub_123', {
      notePurpose: 'school',
      otherNotePurpose: null,
      absenceReason: 'Illness',
      otherAbsenceReason: null,
    })

    expect(result).toEqual({
      success: false,
      error: 'Submission is no longer pending review',
    })
  })
})

describe('denySubmission - Denial Automation', () => {
  const mockSubmissionId = 'sub_123'
  const mockDoctorId = 'doctor_123'
  const mockPaymentIntentId = 'pi_test_123'
  const mockRefundId = 're_test_123'

  const mockSubmission = {
    id: mockSubmissionId,
    stripePaymentIntentId: mockPaymentIntentId,
    stripeRefundId: null,
    email: 'patient@example.com',
    phone: '(555) 123-4567',
    smsOptIn: true,
    smsPhoneE164: '+15551234567',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    status: SubmissionStatus.PENDING_REVIEW,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockGetSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful denial flow', () => {
    it('should successfully deny submission with refund and email', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(mockSubmission)
      mockMarkSubmissionRefundReserved.mockResolvedValue(1)
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockSendDenialEmail.mockResolvedValue({ success: true })

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({ success: true })

      expect(mockMarkSubmissionRefundReserved).toHaveBeenCalledWith(mockSubmissionId, {
        denialReason: 'Legal',
        reviewedByAdminId: mockDoctorId,
        reviewedAt: expect.any(Date),
      })

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: mockPaymentIntentId,
          reason: 'requested_by_customer',
          metadata: expect.objectContaining({
            submissionId: mockSubmissionId,
            denialReason: 'Legal',
            processedBy: 'admin-denial-automation',
          }),
        }),
        expect.objectContaining({
          idempotencyKey: `refund_${mockSubmissionId}_${mockDoctorId}`,
        })
      )

      expect(mockSendDenialEmail).toHaveBeenCalledWith({
        to: 'patient@example.com',
        patientName: 'John Doe',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })
      expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalledWith({
        submission: expect.objectContaining({
          id: mockSubmissionId,
          phone: '(555) 123-4567',
          smsOptIn: true,
          smsPhoneE164: '+15551234567',
        }),
        type: 'DENIAL_SENT',
        body: expect.stringMatching(/denied and refunded[\s\S]*Reply HELP[\s\S]*STOP to opt out/),
      })

      expect(mockRecordSubmissionRefund).toHaveBeenCalledTimes(1)
      expect(mockRecordSubmissionRefund).toHaveBeenCalledWith(mockSubmissionId, mockRefundId)
      expect(mockRecordDenialEmailSent).toHaveBeenCalledTimes(1)
      expect(mockRecordDenialEmailSent).toHaveBeenCalledWith(mockSubmissionId, expect.any(Date))
      expect(mockRecordSubmissionRefund.mock.invocationCallOrder[0]).toBeLessThan(
        mockRecordDenialEmailSent.mock.invocationCallOrder[0]
      )
      expect(mockReleaseSubmissionRefundReservation).not.toHaveBeenCalled()
    })

    it('should handle "7+ days" denial reason correctly', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(mockSubmission)
      mockMarkSubmissionRefundReserved.mockResolvedValue(1)
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockSendDenialEmail.mockResolvedValue({ success: true })

      const result = await denySubmission(mockSubmissionId, '7+ days')

      expect(result).toEqual({ success: true })
      expect(mockSendDenialEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          denialReason: '7+ days',
        })
      )
    })

    it('should handle "Other" denial reason correctly', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(mockSubmission)
      mockMarkSubmissionRefundReserved.mockResolvedValue(1)
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockSendDenialEmail.mockResolvedValue({ success: true })

      const result = await denySubmission(mockSubmissionId, 'Other')

      expect(result).toEqual({ success: true })
      expect(mockSendDenialEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          denialReason: 'Other',
        })
      )
    })

    it('persists "Refund (Denial)" as a distinct denial reason', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(mockSubmission)
      mockMarkSubmissionRefundReserved.mockResolvedValue(1)
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockSendDenialEmail.mockResolvedValue({ success: true })

      const result = await denySubmission(mockSubmissionId, 'Refund (Denial)')

      expect(result).toEqual({ success: true })
      expect(mockMarkSubmissionRefundReserved).toHaveBeenCalledWith(
        mockSubmissionId,
        expect.objectContaining({
          denialReason: 'Refund (Denial)',
        })
      )
      expect(mockRefundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            denialReason: 'Refund (Denial)',
          }),
        }),
        expect.any(Object)
      )
      expect(mockSendDenialEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          denialReason: 'Refund (Denial)',
        })
      )
    })
  })

  describe('Refund failure scenarios (BLOCKING)', () => {
    it('should block denial if Stripe refund fails', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(mockSubmission)
      mockMarkSubmissionRefundReserved.mockResolvedValue(1)
      mockRefundsCreate.mockRejectedValue(new Error('Insufficient funds'))

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({
        success: false,
        error: 'Failed to process refund: Insufficient funds',
      })

      expect(mockMarkSubmissionRefundReserved).toHaveBeenCalled()

      expect(mockReleaseSubmissionRefundReservation).toHaveBeenCalledWith(mockSubmissionId)

      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    })

    it('should block denial if payment intent not found in Stripe', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(mockSubmission)
      mockMarkSubmissionRefundReserved.mockResolvedValue(1)
      mockRefundsCreate.mockRejectedValue(new Error('No such payment_intent'))

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({
        success: false,
        error: 'Failed to process refund: No such payment_intent',
      })

      expect(mockReleaseSubmissionRefundReservation).toHaveBeenCalledWith(mockSubmissionId)
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    })
  })

  describe('Email failure scenarios (NON-BLOCKING)', () => {
    it('should still deny if email fails but refund succeeds', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(mockSubmission)
      mockMarkSubmissionRefundReserved.mockResolvedValue(1)
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockSendDenialEmail.mockRejectedValue(new Error('Email service unavailable'))

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({
        success: true,
        warning: 'Submission denied and refunded, but email notification failed to send',
      })

      expect(mockRefundsCreate).toHaveBeenCalled()

      expect(mockSendDenialEmail).toHaveBeenCalled()
      expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()

      expect(mockRecordSubmissionRefund).toHaveBeenCalledTimes(1)
      expect(mockRecordSubmissionRefund).toHaveBeenCalledWith(mockSubmissionId, mockRefundId)
      expect(mockRecordDenialEmailSent).not.toHaveBeenCalled()
      expect(mockReleaseSubmissionRefundReservation).not.toHaveBeenCalled()
    })
  })

  describe('Validation scenarios', () => {
    it('should fail if submission not found', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(null)

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({
        success: false,
        error: 'Submission not found',
      })
    })

    it('should fail if submission already denied', async () => {
      mockFindSubmissionForDenial.mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.DENIED,
      })

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({
        success: false,
        error: 'Cannot deny submission with status: DENIED',
      })
    })

    it('should fail if submission already approved', async () => {
      mockFindSubmissionForDenial.mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.APPROVED,
      })

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({
        success: false,
        error: 'Cannot deny submission with status: APPROVED',
      })
    })

    it('should fail if no payment intent ID exists', async () => {
      mockFindSubmissionForDenial.mockResolvedValue({
        ...mockSubmission,
        stripePaymentIntentId: null,
      })

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({
        success: false,
        error: 'No payment intent ID found for this submission',
      })
    })

    it('should fail if refund already processed (idempotency check)', async () => {
      mockFindSubmissionForDenial.mockResolvedValue({
        ...mockSubmission,
        stripeRefundId: 're_existing_refund',
      })

      const result = await denySubmission(mockSubmissionId, 'Legal')

      expect(result).toEqual({
        success: false,
        error: 'Refund already processed for this submission',
      })
    })

    it('redirects to the admin login without a session', async () => {
      mockGetSession.mockResolvedValue(null)

      await expect(denySubmission(mockSubmissionId, 'Legal')).rejects.toMatchObject({
        digest: expect.stringContaining(';/admin/login;'),
      })
      expect(mockFindSubmissionForDenial).not.toHaveBeenCalled()
      expect(mockRefundsCreate).not.toHaveBeenCalled()
    })
  })

  describe('Payment amount calculation', () => {
    it('should convert cents to dollars correctly for email', async () => {
      mockFindSubmissionForDenial.mockResolvedValue(mockSubmission)
      mockMarkSubmissionRefundReserved.mockResolvedValue(1)
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockSendDenialEmail.mockResolvedValue({ success: true })

      await denySubmission(mockSubmissionId, 'Legal')

      expect(mockSendDenialEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmount: 24.95,
        })
      )
    })
  })
})

describe('changeSubmissionStatus - Denial SMS', () => {
  const mockSubmissionId = 'sub_123'
  const mockDoctorId = 'doctor_123'

  const mockSubmission = {
    id: mockSubmissionId,
    stripePaymentIntentId: 'pi_test_123',
    stripeRefundId: null,
    email: 'patient@example.com',
    phone: '(555) 123-4567',
    smsOptIn: true,
    smsPhoneE164: '+15551234567',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    status: SubmissionStatus.APPROVED,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })
    mockSendDenialEmail.mockResolvedValue({ success: true })
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends denial SMS after status-change denial email succeeds', async () => {
    mockFindSubmissionById.mockResolvedValue(mockSubmission)
    mockRefundsCreate.mockResolvedValue({
      id: 're_test_123',
      amount: 2495,
    })

    const result = await changeSubmissionStatus(mockSubmissionId, SubmissionStatus.DENIED, 'Legal')

    expect(result).toEqual({ success: true, warning: undefined })
    expect(mockSendDenialEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'John Doe',
      denialReason: 'Legal',
      refundAmount: 24.95,
    })
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalledWith({
      submission: expect.objectContaining({
        id: mockSubmissionId,
        phone: '(555) 123-4567',
        smsOptIn: true,
      }),
      type: 'DENIAL_SENT',
      body: expect.stringMatching(/denied and refunded[\s\S]*Reply HELP[\s\S]*STOP to opt out/),
    })
  })

  it('sends denial SMS after already-refunded denial email succeeds', async () => {
    mockFindSubmissionById.mockResolvedValue({
      ...mockSubmission,
      stripeRefundId: 're_existing_refund',
    })

    const result = await changeSubmissionStatus(mockSubmissionId, SubmissionStatus.DENIED, 'Legal')

    expect(result).toEqual({
      success: true,
      warning: 'Submission denied. Note: Refund was already processed previously.',
    })
    expect(mockRefundsCreate).not.toHaveBeenCalled()
    expect(mockSendDenialEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'John Doe',
      denialReason: 'Legal',
      refundAmount: 0,
    })
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalledWith({
      submission: expect.objectContaining({
        id: mockSubmissionId,
        smsOptIn: true,
      }),
      type: 'DENIAL_SENT',
      body: expect.stringMatching(/denied and refunded[\s\S]*Reply HELP[\s\S]*STOP to opt out/),
    })
  })
})

describe('maybeSubmission - Maybe Review Workflow', () => {
  const mockSubmissionId = 'sub_123'
  const mockDoctorId = 'doctor_123'

  const mockSubmission = {
    id: mockSubmissionId,
    stripePaymentIntentId: 'pi_test_123',
    stripeRefundId: null,
    email: 'patient@example.com',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    status: SubmissionStatus.PENDING_REVIEW,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })
    mockMarkPendingSubmissionMaybe.mockResolvedValue(1)
    mockSendMaybeEmail.mockResolvedValue({ id: 'email_123' })
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('moves a pending submission to maybe, sends email, and stores the email timestamp', async () => {
    mockFindSubmissionById.mockResolvedValue(mockSubmission)

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'DATES_EXCEED_ALLOWED_RANGE',
      approvedDays: 3,
      internalNote: 'Review date range',
    })

    expect(result).toEqual({ success: true })
    expect(mockMarkPendingSubmissionMaybe).toHaveBeenCalledWith(mockSubmissionId, {
      maybeReason: 'DATES_EXCEED_ALLOWED_RANGE',
      maybeInternalNote: 'Review date range',
      maybeApprovedDays: 3,
      reviewedByAdminId: mockDoctorId,
      reviewedAt: expect.any(Date),
    })
    expect(mockSendMaybeEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'John Doe',
      reason: 'DATES_EXCEED_ALLOWED_RANGE',
      approvedDays: 3,
    })
    expect(mockRecordMaybeEmailSent).toHaveBeenCalledWith(mockSubmissionId, expect.any(Date))
  })

  it('sends the more-info request to the customer exactly once without changing note content', async () => {
    mockFindSubmissionById.mockResolvedValue({
      ...mockSubmission,
      additionalInformation: 'Existing chart details',
    })

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'MORE_INFO_NEEDED',
      internalNote: 'Awaiting customer reply',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendMaybeEmail).toHaveBeenCalledTimes(1)
    expect(mockSendMaybeEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'John Doe',
      reason: 'MORE_INFO_NEEDED',
      approvedDays: null,
    })
    expect(mockMarkPendingSubmissionMaybe).toHaveBeenCalledWith(
      mockSubmissionId,
      expect.objectContaining({
        maybeReason: 'MORE_INFO_NEEDED',
        maybeInternalNote: 'Awaiting customer reply',
        reviewedByAdminId: mockDoctorId,
      })
    )
    expect(mockMarkPendingSubmissionMaybe.mock.calls[0][1]).not.toHaveProperty(
      'additionalInformation'
    )
    expect(mockMarkSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockRecordMaybeEmailSent).toHaveBeenCalledTimes(1)
    expect(mockRecordMaybeEmailSent).toHaveBeenCalledWith(mockSubmissionId, expect.any(Date))
  })

  it('redirects to the admin login before sending a more-info request without a session', async () => {
    mockGetSession.mockResolvedValue(null)

    await expect(
      maybeSubmission(mockSubmissionId, { reason: 'MORE_INFO_NEEDED' })
    ).rejects.toMatchObject({ digest: expect.stringContaining(';/admin/login;') })
    expect(mockFindSubmissionById).not.toHaveBeenCalled()
    expect(mockMarkPendingSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
  })

  it('sends maybe SMS after the maybe email succeeds', async () => {
    mockFindSubmissionById.mockResolvedValue({
      ...mockSubmission,
      phone: '(555) 123-4567',
      smsOptIn: true,
    })
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'OTHER_REVIEW',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendMaybeEmail).toHaveBeenCalled()
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalledWith({
      submission: expect.objectContaining({
        id: mockSubmissionId,
        phone: '(555) 123-4567',
        smsOptIn: true,
      }),
      type: 'MAYBE_UPDATE',
      body: expect.stringMatching(/extra review[\s\S]*Reply HELP[\s\S]*STOP to opt out/),
    })
  })

  it('moves a pending submission to maybe without email for the internal-only reason', async () => {
    mockFindSubmissionById.mockResolvedValue(mockSubmission)

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'INTERNAL_ONLY',
      internalNote: 'Fix note reason',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
    expect(mockMarkSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockRecordMaybeEmailSent).not.toHaveBeenCalled()
    expect(mockMarkPendingSubmissionMaybe).toHaveBeenCalledWith(
      mockSubmissionId,
      expect.objectContaining({
        maybeReason: 'INTERNAL_ONLY',
        maybeInternalNote: 'Fix note reason',
        maybeApprovedDays: null,
      })
    )
  })

  it('does not send maybe email when a non-pending submission is moved to maybe', async () => {
    mockFindSubmissionById.mockResolvedValue({
      ...mockSubmission,
      status: SubmissionStatus.APPROVED,
    })

    const result = await changeSubmissionStatus(
      mockSubmissionId,
      SubmissionStatus.MAYBE,
      undefined,
      { reason: 'OTHER_REVIEW' }
    )

    expect(result).toEqual({ success: true })
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
    expect(mockMarkPendingSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockMarkSubmissionMaybe).toHaveBeenCalledWith(
      mockSubmissionId,
      expect.objectContaining({
        maybeReason: 'OTHER_REVIEW',
        maybeApprovedDays: null,
      })
    )
  })

  it('requires approved day selection for dates-exceed maybe reason', async () => {
    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'DATES_EXCEED_ALLOWED_RANGE',
    })

    expect(result).toEqual({
      success: false,
      error: 'Select how many days can be approved',
    })
    expect(mockFindSubmissionById).not.toHaveBeenCalled()
    expect(mockMarkPendingSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
  })

  it('rejects approved day selections outside 1 through 5', async () => {
    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'DATES_EXCEED_ALLOWED_RANGE',
      approvedDays: 6,
    })

    expect(result).toEqual({
      success: false,
      error: 'Select how many days can be approved',
    })
    expect(mockFindSubmissionById).not.toHaveBeenCalled()
    expect(mockMarkPendingSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
  })

  it('rejects invalid maybe reasons', async () => {
    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'NOT_A_REAL_REASON',
    })

    expect(result).toEqual({ success: false, error: 'Invalid maybe reason' })
    expect(mockFindSubmissionById).not.toHaveBeenCalled()
    expect(mockMarkSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockRecordMaybeEmailSent).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
  })

  it('still moves to maybe when email sending fails', async () => {
    mockFindSubmissionById.mockResolvedValue(mockSubmission)
    mockSendMaybeEmail.mockRejectedValue(new Error('Email unavailable'))

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'OTHER_REVIEW',
    })

    expect(result).toEqual({
      success: true,
      warning: 'Submission moved to Maybe, but email notification failed to send',
    })
    expect(mockMarkPendingSubmissionMaybe).toHaveBeenCalledTimes(1)
    expect(mockMarkSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockRecordMaybeEmailSent).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).toHaveBeenCalled()
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
  })

  it('surfaces more-info delivery failure without recording a sent timestamp', async () => {
    mockFindSubmissionById.mockResolvedValue(mockSubmission)
    mockSendMaybeEmail.mockRejectedValue(new Error('Resend unavailable'))

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'MORE_INFO_NEEDED',
    })

    expect(result).toEqual({
      success: true,
      warning: 'Submission moved to Maybe, but email notification failed to send',
    })
    expect(mockMarkPendingSubmissionMaybe).toHaveBeenCalledTimes(1)
    expect(mockSendMaybeEmail).toHaveBeenCalledTimes(1)
    expect(mockMarkSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockRecordMaybeEmailSent).not.toHaveBeenCalled()
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
  })

  it('does not send duplicate email if another doctor already moved the pending submission', async () => {
    mockFindSubmissionById.mockResolvedValue(mockSubmission)
    mockMarkPendingSubmissionMaybe.mockResolvedValue(0)

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'MORE_INFO_NEEDED',
    })

    expect(result).toEqual({
      success: false,
      error: 'This submission has already been reviewed by another doctor',
    })
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
    expect(mockMarkSubmissionMaybe).not.toHaveBeenCalled()
    expect(mockRecordMaybeEmailSent).not.toHaveBeenCalled()
  })
})
