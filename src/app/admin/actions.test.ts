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
  mockUpdate,
  mockUpdateMany,
  mockSendDenialEmail,
  mockSendMaybeEmail,
  mockGetSession,
} = vi.hoisted(() => ({
  mockRefundsCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockSendDenialEmail: vi.fn(),
  mockSendMaybeEmail: vi.fn(),
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
import { changeSubmissionStatus, denySubmission, maybeSubmission } from './actions'

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
  })

  it('does not send duplicate email if another doctor already moved the pending submission', async () => {
    mockFindUnique.mockResolvedValue(mockSubmission)
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const result = await maybeSubmission(mockSubmissionId, {
      reason: 'OTHER_REVIEW',
    })

    expect(result).toEqual({
      success: false,
      error: 'This submission has already been reviewed by another doctor',
    })
    expect(mockSendMaybeEmail).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
