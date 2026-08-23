/**
 * Tests for Admin Server Actions - Denial Automation
 * Tests refund processing and email notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SubmissionStatus } from '@prisma/client'

// Hoist mocks to the top level
const {
  mockRefundsCreate,
  mockFindUnique,
  mockFindMany,
  mockCount,
  mockUpdate,
  mockUpdateMany,
  mockSendDenialEmail,
  mockSendMaybeEmail,
  mockSendTransactionalSmsForSubmission,
  mockNormalizeMedicalRecordNumber,
  mockRevokeNoteVerificationForSubmission,
  mockGetSession,
} = vi.hoisted(() => ({
  mockRefundsCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
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

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      refunds = {
        create: mockRefundsCreate,
      }
    },
  }
})

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    submission: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      count: mockCount,
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
  },
}))

// Mock email utility
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
  revokeNoteVerificationById: vi.fn(),
  revokeOtherNoteVerificationsForSubmission: vi.fn(),
  revokeNoteVerificationForSubmission: mockRevokeNoteVerificationForSubmission,
}))

// Mock Better Auth
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

// Now import the functions under test
import {
  changeSubmissionStatus,
  denySubmission,
  maybeSubmission,
  searchSubmissions,
  updateSubmission,
  updateReviewClassification,
} from './actions'

describe('searchSubmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: 'doctor_123' },
    })
    mockFindMany.mockResolvedValue([
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
    ])
    mockCount.mockResolvedValue(1)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('searches submissions by normalized Medical Record #', async () => {
    const result = await searchSubmissions({
      query: ' fat5-yhab ',
      searchType: 'medicalRecord',
    })

    const expectedWhere = {
      noteVerifications: {
        some: {
          medicalRecordNumber: 'FAT5YHAB',
        },
      },
    }

    expect(mockNormalizeMedicalRecordNumber).toHaveBeenCalledWith('fat5-yhab')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      })
    )
    expect(mockCount).toHaveBeenCalledWith({ where: expectedWhere })
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
    mockUpdate.mockResolvedValue({})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('clears SMS consent when admins change the consented phone number', async () => {
    mockFindUnique.mockResolvedValue({
      phone: '(555) 123-4567',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
    })

    const result = await updateSubmission('sub_123', {
      phone: '(555) 987-6543',
    })

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sub_123' },
      data: expect.objectContaining({
        phone: '(555) 987-6543',
        smsOptIn: false,
        smsOptInAt: null,
        smsConsentVersion: null,
        smsPhoneE164: null,
        updatedAt: expect.any(Date),
      }),
    })
  })

  it('keeps SMS consent when admins only reformat the same phone number', async () => {
    mockFindUnique.mockResolvedValue({
      phone: '(555) 123-4567',
      smsOptIn: true,
      smsPhoneE164: '+15551234567',
    })

    const result = await updateSubmission('sub_123', {
      phone: '+1 555 123 4567',
    })

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sub_123' },
      data: expect.objectContaining({
        phone: '+1 555 123 4567',
        smsPhoneE164: '+15551234567',
        updatedAt: expect.any(Date),
      }),
    })
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsOptIn: false,
        }),
      })
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
    mockUpdateMany.mockResolvedValue({ count: 1 })

    const result = await updateReviewClassification('sub_123', {
      notePurpose: 'school',
      otherNotePurpose: null,
      absenceReason: 'Illness',
      otherAbsenceReason: null,
    })

    expect(result).toEqual({ success: true })
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'sub_123',
        status: SubmissionStatus.PENDING_REVIEW,
      },
      data: expect.objectContaining({
        notePurpose: 'school',
        otherNotePurpose: null,
        absenceReason: 'Illness',
        otherAbsenceReason: null,
        updatedAt: expect.any(Date),
      }),
    })
  })

  it('rejects classification updates once a submission leaves review', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })

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
    // Reset all mocks before each test
    vi.clearAllMocks()

    // Default mock implementations
    mockGetSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })

    // Environment variables are managed by global test setup
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful denial flow', () => {
    it('should successfully deny submission with refund and email', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockUpdateMany.mockResolvedValue({ count: 1 }) // Optimistic locking succeeds
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495, // Amount in cents from Stripe refund
      })
      mockUpdate.mockResolvedValue({})
      mockSendDenialEmail.mockResolvedValue({ success: true })

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({ success: true })

      // Verify optimistic locking (database updated first with placeholder)
      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: mockSubmissionId,
            status: { in: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE] },
            stripeRefundId: null,
          }),
          data: expect.objectContaining({
            status: SubmissionStatus.DENIED,
            denialReason: 'Legal',
            reviewedByAdminId: mockDoctorId,
            stripeRefundId: `pending_${mockSubmissionId}`, // Placeholder
          }),
        })
      )

      // Verify refund was created with correct metadata AND idempotency key
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
          idempotencyKey: `refund_${mockSubmissionId}_${mockDoctorId}`, // FIX 2: Idempotency key
        })
      )

      // Verify email was sent
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

      // Verify database was updated with real refund ID and email timestamp
      expect(mockUpdate).toHaveBeenCalledTimes(2) // 1) Set refund ID, 2) Set email timestamp
      expect(mockUpdate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: mockSubmissionId },
          data: { stripeRefundId: mockRefundId }, // Replace placeholder with real ID
        })
      )
      expect(mockUpdate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: mockSubmissionId },
          data: { denialEmailSentAt: expect.any(Date) }, // Email succeeded
        })
      )
    })

    it('should handle "7+ days" denial reason correctly', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockUpdateMany.mockResolvedValue({ count: 1 })
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockUpdate.mockResolvedValue({})
      mockSendDenialEmail.mockResolvedValue({ success: true })

      // Act
      const result = await denySubmission(mockSubmissionId, '7+ days')

      // Assert
      expect(result).toEqual({ success: true })
      expect(mockSendDenialEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          denialReason: '7+ days',
        })
      )
    })

    it('should handle "Other" denial reason correctly', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockUpdateMany.mockResolvedValue({ count: 1 })
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockUpdate.mockResolvedValue({})
      mockSendDenialEmail.mockResolvedValue({ success: true })

      // Act
      const result = await denySubmission(mockSubmissionId, 'Other')

      // Assert
      expect(result).toEqual({ success: true })
      expect(mockSendDenialEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          denialReason: 'Other',
        })
      )
    })

    it('persists "Refund (Denial)" as a distinct denial reason', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockUpdateMany.mockResolvedValue({ count: 1 })
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockUpdate.mockResolvedValue({})
      mockSendDenialEmail.mockResolvedValue({ success: true })

      // Act
      const result = await denySubmission(mockSubmissionId, 'Refund (Denial)')

      // Assert
      expect(result).toEqual({ success: true })
      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            denialReason: 'Refund (Denial)',
          }),
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
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockUpdateMany.mockResolvedValue({ count: 1 })
      mockRefundsCreate.mockRejectedValue(new Error('Insufficient funds'))

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to process refund: Insufficient funds',
      })

      // Verify optimistic lock was acquired
      expect(mockUpdateMany).toHaveBeenCalled()

      // Verify database was rolled back after refund failure
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubmissionId },
          data: expect.objectContaining({
            status: SubmissionStatus.PENDING_REVIEW, // Rolled back
            stripeRefundId: null,
          }),
        })
      )

      // Verify email was NOT sent
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    })

    it('should block denial if payment intent not found in Stripe', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockUpdateMany.mockResolvedValue({ count: 1 })
      mockRefundsCreate.mockRejectedValue(new Error('No such payment_intent'))

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to process refund: No such payment_intent',
      })

      // Verify rollback happened
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubmissionStatus.PENDING_REVIEW,
          }),
        })
      )
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    })
  })

  describe('Email failure scenarios (NON-BLOCKING)', () => {
    it('should still deny if email fails but refund succeeds', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockUpdateMany.mockResolvedValue({ count: 1 })
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495,
      })
      mockUpdate.mockResolvedValue({})
      mockSendDenialEmail.mockRejectedValue(new Error('Email service unavailable'))

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert - Should succeed with warning
      expect(result).toEqual({
        success: true,
        warning: 'Submission denied and refunded, but email notification failed to send',
      })

      // Verify refund was processed
      expect(mockRefundsCreate).toHaveBeenCalled()

      // Verify email was attempted
      expect(mockSendDenialEmail).toHaveBeenCalled()
      expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()

      // Verify database was updated with refund ID but NOT email timestamp
      expect(mockUpdate).toHaveBeenCalledTimes(1) // Only refund ID update, no email timestamp
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubmissionId },
          data: { stripeRefundId: mockRefundId },
        })
      )
    })
  })

  describe('Validation scenarios', () => {
    it('should fail if submission not found', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(null)

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Submission not found',
      })
    })

    it('should fail if submission already denied', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.DENIED,
      })

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Cannot deny submission with status: DENIED',
      })
    })

    it('should fail if submission already approved', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.APPROVED,
      })

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Cannot deny submission with status: APPROVED',
      })
    })

    it('should fail if no payment intent ID exists', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue({
        ...mockSubmission,
        stripePaymentIntentId: null,
      })

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'No payment intent ID found for this submission',
      })
    })

    it('should fail if refund already processed (idempotency check)', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue({
        ...mockSubmission,
        stripeRefundId: 're_existing_refund',
      })

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Refund already processed for this submission',
      })
    })

    it('should fail if no authenticated doctor session', async () => {
      // Arrange
      mockGetSession.mockResolvedValue(null)

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert - Should return error (not throw)
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Unauthorized'),
      })
    })
  })

  describe('Payment amount calculation', () => {
    it('should convert cents to dollars correctly for email', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockUpdateMany.mockResolvedValue({ count: 1 })
      mockRefundsCreate.mockResolvedValue({
        id: mockRefundId,
        amount: 2495, // 2495 cents from Stripe
      })
      mockUpdate.mockResolvedValue({})
      mockSendDenialEmail.mockResolvedValue({ success: true })

      // Act
      await denySubmission(mockSubmissionId, 'Legal')

      // Assert - 2495 cents = $24.95
      expect(mockSendDenialEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmount: 24.95, // Correctly converted to dollars
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
    mockUpdate.mockResolvedValue({})
    mockSendDenialEmail.mockResolvedValue({ success: true })
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends denial SMS after status-change denial email succeeds', async () => {
    mockFindUnique.mockResolvedValue(mockSubmission)
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
    mockFindUnique.mockResolvedValue({
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
    mockUpdate.mockResolvedValue({})
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockSendMaybeEmail.mockResolvedValue({ id: 'email_123' })
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('moves a pending submission to maybe, sends email, and stores the email timestamp', async () => {
    mockFindUnique.mockResolvedValue(mockSubmission)

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'DATES_EXCEED_ALLOWED_RANGE',
      approvedDays: 3,
      internalNote: 'Review date range',
    })

    expect(result).toEqual({ success: true })
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: mockSubmissionId,
          status: SubmissionStatus.PENDING_REVIEW,
        },
        data: expect.objectContaining({
          status: SubmissionStatus.MAYBE,
          maybeReason: 'DATES_EXCEED_ALLOWED_RANGE',
          maybeInternalNote: 'Review date range',
          maybeApprovedDays: 3,
          maybeEmailSentAt: null,
          reviewedByAdminId: mockDoctorId,
          reviewedAt: expect.any(Date),
        }),
      })
    )
    expect(mockSendMaybeEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      patientName: 'John Doe',
      reason: 'DATES_EXCEED_ALLOWED_RANGE',
      approvedDays: 3,
    })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: mockSubmissionId },
      data: { maybeEmailSentAt: expect.any(Date) },
    })
  })

  it('sends the more-info request to the customer exactly once without changing note content', async () => {
    mockFindUnique.mockResolvedValue({
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
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockSubmissionId, status: SubmissionStatus.PENDING_REVIEW },
        data: expect.objectContaining({
          status: SubmissionStatus.MAYBE,
          maybeReason: 'MORE_INFO_NEEDED',
          maybeInternalNote: 'Awaiting customer reply',
          maybeEmailSentAt: null,
          reviewedByAdminId: mockDoctorId,
        }),
      })
    )
    expect(mockUpdateMany.mock.calls[0][0].data).not.toHaveProperty('additionalInformation')
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: mockSubmissionId },
      data: { maybeEmailSentAt: expect.any(Date) },
    })
  })

  it('requires an authenticated admin session before sending a more-info request', async () => {
    mockGetSession.mockResolvedValue(null)

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'MORE_INFO_NEEDED',
    })

    expect(result).toEqual({ success: false, error: 'Failed to mark submission as maybe' })
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
  })

  it('sends maybe SMS after the maybe email succeeds', async () => {
    mockFindUnique.mockResolvedValue({
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
    mockFindUnique.mockResolvedValue(mockSubmission)

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'INTERNAL_ONLY',
      internalNote: 'Fix note reason',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: mockSubmissionId,
          status: SubmissionStatus.PENDING_REVIEW,
        },
        data: expect.objectContaining({
          status: SubmissionStatus.MAYBE,
          maybeReason: 'INTERNAL_ONLY',
          maybeInternalNote: 'Fix note reason',
          maybeApprovedDays: null,
          maybeEmailSentAt: null,
        }),
      })
    )
  })

  it('does not send maybe email when a non-pending submission is moved to maybe', async () => {
    mockFindUnique.mockResolvedValue({
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
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SubmissionStatus.MAYBE,
          maybeReason: 'OTHER_REVIEW',
          maybeApprovedDays: null,
          maybeEmailSentAt: null,
        }),
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
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
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
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
  })

  it('rejects invalid maybe reasons', async () => {
    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'NOT_A_REAL_REASON',
    })

    expect(result).toEqual({ success: false, error: 'Invalid maybe reason' })
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
  })

  it('still moves to maybe when email sending fails', async () => {
    mockFindUnique.mockResolvedValue(mockSubmission)
    mockSendMaybeEmail.mockRejectedValue(new Error('Email unavailable'))

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'OTHER_REVIEW',
    })

    expect(result).toEqual({
      success: true,
      warning: 'Submission moved to Maybe, but email notification failed to send',
    })
    expect(mockUpdateMany).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockSendMaybeEmail).toHaveBeenCalled()
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
  })

  it('surfaces more-info delivery failure without recording a sent timestamp', async () => {
    mockFindUnique.mockResolvedValue(mockSubmission)
    mockSendMaybeEmail.mockRejectedValue(new Error('Resend unavailable'))

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'MORE_INFO_NEEDED',
    })

    expect(result).toEqual({
      success: true,
      warning: 'Submission moved to Maybe, but email notification failed to send',
    })
    expect(mockUpdateMany).toHaveBeenCalledTimes(1)
    expect(mockSendMaybeEmail).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
  })

  it('does not send duplicate email if another doctor already moved the pending submission', async () => {
    mockFindUnique.mockResolvedValue(mockSubmission)
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'MORE_INFO_NEEDED',
    })

    expect(result).toEqual({
      success: false,
      error: 'This submission has already been reviewed by another doctor',
    })
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
