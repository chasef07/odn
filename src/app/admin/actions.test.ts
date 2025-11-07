/**
 * Tests for Admin Server Actions - Denial Automation
 * Tests refund processing and email notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SubmissionStatus } from '@prisma/client'

// Hoist mocks to the top level
const { mockRefundsCreate, mockFindUnique, mockUpdate, mockSendDenialEmail, mockGetServerSession } = vi.hoisted(() => ({
  mockRefundsCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockSendDenialEmail: vi.fn(),
  mockGetServerSession: vi.fn(),
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
    },
  },
}))

// Mock email utility
vi.mock('@/lib/email', () => ({
  sendDenialEmail: mockSendDenialEmail,
}))

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock auth config
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

// Now import the function under test
import { denySubmission } from './actions'

describe('denySubmission - Denial Automation', () => {
  const mockSubmissionId = 'sub_123'
  const mockDoctorId = 'doctor_123'
  const mockPaymentIntentId = 'pi_test_123'
  const mockRefundId = 're_test_123'

  const mockSubmission = {
    id: mockSubmissionId,
    stripePaymentIntentId: mockPaymentIntentId,
    email: 'patient@example.com',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    status: SubmissionStatus.PENDING_REVIEW,
  }

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()

    // Default mock implementations
    mockGetServerSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })

    // Set environment variables
    process.env.NEXT_PUBLIC_PAYMENT_AMOUNT = '2495' // $24.95
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful denial flow', () => {
    it('should successfully deny submission with refund and email', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockRefundsCreate.mockResolvedValue({ id: mockRefundId })
      mockUpdate.mockResolvedValue({})
      mockSendDenialEmail.mockResolvedValue({ success: true })

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({ success: true })

      // Verify submission was fetched
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: mockSubmissionId },
        select: {
          id: true,
          stripePaymentIntentId: true,
          email: true,
          patientFirstName: true,
          patientLastName: true,
          status: true,
        },
      })

      // Verify refund was created
      expect(mockRefundsCreate).toHaveBeenCalledWith({
        payment_intent: mockPaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          submissionId: mockSubmissionId,
          denialReason: 'Legal',
          processedBy: 'admin-denial-automation',
        },
      })

      // Verify database was updated with denial and refund details
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubmissionId },
          data: expect.objectContaining({
            status: SubmissionStatus.DENIED,
            denialReason: 'Legal',
            reviewedByAdminId: mockDoctorId,
            stripeRefundId: mockRefundId,
          }),
        })
      )

      // Verify email was sent
      expect(mockSendDenialEmail).toHaveBeenCalledWith({
        to: 'patient@example.com',
        patientName: 'John Doe',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Verify denialEmailSentAt was updated
      expect(mockUpdate).toHaveBeenCalledTimes(2) // Once for denial, once for email timestamp
    })

    it('should handle "7+ days" denial reason correctly', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockRefundsCreate.mockResolvedValue({ id: mockRefundId })
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
      mockRefundsCreate.mockResolvedValue({ id: mockRefundId })
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
      mockRefundsCreate.mockRejectedValue(new Error('Insufficient funds'))

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to process refund: Insufficient funds',
      })

      // Verify database was NOT updated (no denial)
      expect(mockUpdate).not.toHaveBeenCalled()

      // Verify email was NOT sent
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    })

    it('should block denial if payment intent not found in Stripe', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockRefundsCreate.mockRejectedValue(new Error('No such payment_intent'))

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to process refund: No such payment_intent',
      })

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    })
  })

  describe('Email failure scenarios (NON-BLOCKING)', () => {
    it('should still deny if email fails but refund succeeds', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockRefundsCreate.mockResolvedValue({ id: mockRefundId })
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

      // Verify database was updated with denial
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubmissionId },
          data: expect.objectContaining({
            status: SubmissionStatus.DENIED,
            stripeRefundId: mockRefundId,
          }),
        })
      )

      // Verify email was attempted
      expect(mockSendDenialEmail).toHaveBeenCalled()

      // Verify denialEmailSentAt was NOT updated (only 1 update call, not 2)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
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

      expect(mockRefundsCreate).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
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

      expect(mockRefundsCreate).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
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

      expect(mockRefundsCreate).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
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

      expect(mockRefundsCreate).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    })

    it('should fail if no authenticated doctor session', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(null)

      // Act
      const result = await denySubmission(mockSubmissionId, 'Legal')

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to deny submission: Unauthorized: No active session',
      })

      expect(mockFindUnique).not.toHaveBeenCalled()
      expect(mockRefundsCreate).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    })
  })

  describe('Payment amount calculation', () => {
    it('should convert cents to dollars correctly for email', async () => {
      // Arrange - Using the payment amount set in beforeEach (2495 cents)
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockRefundsCreate.mockResolvedValue({ id: mockRefundId })
      mockUpdate.mockResolvedValue({})
      mockSendDenialEmail.mockResolvedValue({ success: true })

      // Act
      await denySubmission(mockSubmissionId, 'Legal')

      // Assert - 2495 cents = $24.95
      expect(mockSendDenialEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          refundAmount: 24.95,
        })
      )
    })
  })
})
