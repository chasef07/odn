/**
 * Tests for Admin Server Actions - Approval Automation
 * Tests PDF generation and email notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SubmissionStatus } from '@prisma/client'

// Hoist mocks to the top level
const {
  mockFindUnique,
  mockUpdate,
  mockSendApprovalEmail,
  mockGenerateDoctorNotePDF,
  mockGeneratePDFFilename,
  mockGetSession,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockSendApprovalEmail: vi.fn(),
  mockGenerateDoctorNotePDF: vi.fn(),
  mockGeneratePDFFilename: vi.fn(),
  mockGetSession: vi.fn(),
}))

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
  sendDenialEmail: vi.fn(), // Keep for other tests
  sendApprovalEmail: mockSendApprovalEmail,
}))

// Mock PDF generation utilities
vi.mock('@/lib/pdf/generate-pdf', () => ({
  generateDoctorNotePDF: mockGenerateDoctorNotePDF,
  generatePDFFilename: mockGeneratePDFFilename,
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

// Mock Stripe
vi.mock('stripe', () => ({
  default: class MockStripe {
    constructor() {
      // Mock Stripe constructor
    }
  },
}))

// Now import the function under test
import { approveSubmission } from '../actions'

describe('approveSubmission - Approval Automation', () => {
  const mockSubmissionId = 'sub_123'
  const mockDoctorId = 'doctor_123'
  const mockPDFBuffer = Buffer.from('mock-pdf-content')
  const mockPDFFilename = 'doctors-note-sub_123.pdf'

  const mockSubmission = {
    id: mockSubmissionId,
    status: SubmissionStatus.PENDING_REVIEW,
    email: 'patient@example.com',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: new Date('1990-01-01'),
    guardianFirstName: null,
    guardianLastName: null,
    guardianDateOfBirth: null,
    recipient: 'myself',
    firstDayOff: new Date('2024-01-15'),
    lastDayOff: new Date('2024-01-17'),
    notePurpose: 'work',
    otherNotePurpose: null,
    absenceReason: 'illness',
    otherAbsenceReason: null,
    symptoms: ['Fever', 'Cough'],
    otherSymptomText: null,
    additionalInformation: 'Flu symptoms',
    state: 'CA',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    stripePaymentIntentId: 'pi_test_123',
    stripeRefundId: null,
    refundedAt: null,
    denialReason: null,
    reviewedAt: null,
    reviewedByAdminId: null,
    approvalEmailSentAt: null,
    denialEmailSentAt: null,
  }

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()

    // Default mock implementations
    mockGetSession.mockResolvedValue({
      user: { id: mockDoctorId },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful approval flow', () => {
    it('should successfully approve submission with PDF and email', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })
      mockUpdate.mockResolvedValue({})

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({ success: true })

      // Verify submission was fetched
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: mockSubmissionId },
      })

      // Verify PDF was generated with submission data
      expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(mockSubmission)

      // Verify PDF filename was generated
      expect(mockGeneratePDFFilename).toHaveBeenCalledWith(mockSubmission.id)

      // Verify email was sent with PDF attachment
      expect(mockSendApprovalEmail).toHaveBeenCalledWith({
        to: 'patient@example.com',
        patientName: 'John Doe',
        notePurpose: 'work',
        absenceReason: 'illness',
        pdfBuffer: mockPDFBuffer,
        pdfFilename: mockPDFFilename,
      })

      // Verify database was updated with approval AND email timestamp (single atomic update)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubmissionId },
          data: expect.objectContaining({
            status: SubmissionStatus.APPROVED,
            reviewedByAdminId: mockDoctorId,
            reviewedAt: expect.any(Date),
            approvalEmailSentAt: expect.any(Date), // Should be set since email succeeded
          }),
        })
      )
    })

    it('should handle different note purposes correctly', async () => {
      // Arrange
      const schoolSubmission = {
        ...mockSubmission,
        notePurpose: 'school',
      }
      mockFindUnique.mockResolvedValue(schoolSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })
      mockUpdate.mockResolvedValue({})

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({ success: true })
      expect(mockSendApprovalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          notePurpose: 'school',
        })
      )
    })

    it('should handle "both" note purpose correctly', async () => {
      // Arrange
      const bothSubmission = {
        ...mockSubmission,
        notePurpose: 'both',
      }
      mockFindUnique.mockResolvedValue(bothSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })
      mockUpdate.mockResolvedValue({})

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({ success: true })
      expect(mockSendApprovalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          notePurpose: 'both',
        })
      )
    })
  })

  describe('PDF generation failure scenarios (BLOCKING)', () => {
    it('should block approval if PDF generation fails', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockGenerateDoctorNotePDF.mockRejectedValue(new Error('Missing signature image'))

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to generate PDF: Missing signature image',
      })

      // Verify database was NOT updated (no approval)
      expect(mockUpdate).not.toHaveBeenCalled()

      // Verify email was NOT sent
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })

    it('should block approval if doctor env vars missing', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockGenerateDoctorNotePDF.mockRejectedValue(
        new Error('Missing required doctor environment variables')
      )

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to generate PDF: Missing required doctor environment variables',
      })

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })
  })

  describe('Email failure scenarios (NON-BLOCKING)', () => {
    it('should still approve if email fails but PDF generation succeeds', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(mockSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockRejectedValue(new Error('Email service unavailable'))
      mockUpdate.mockResolvedValue({})

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert - Should succeed with warning
      expect(result).toEqual({
        success: true,
        warning: 'Submission approved, but email notification failed to send',
      })

      // Verify PDF was generated
      expect(mockGenerateDoctorNotePDF).toHaveBeenCalled()

      // Verify email was attempted
      expect(mockSendApprovalEmail).toHaveBeenCalled()

      // Verify database was updated with approval BUT approvalEmailSentAt is undefined (email failed)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSubmissionId },
          data: expect.objectContaining({
            status: SubmissionStatus.APPROVED,
            approvalEmailSentAt: undefined, // Should be undefined since email failed
          }),
        })
      )
    })
  })

  describe('Validation scenarios', () => {
    it('should fail if submission not found', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue(null)

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Submission not found',
      })

      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })

    it('should fail if submission already approved', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.APPROVED,
      })

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Cannot approve submission with status: APPROVED',
      })

      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })

    it('should fail if submission already denied', async () => {
      // Arrange
      mockFindUnique.mockResolvedValue({
        ...mockSubmission,
        status: SubmissionStatus.DENIED,
      })

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Cannot approve submission with status: DENIED',
      })

      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })

    it('should fail if no authenticated doctor session', async () => {
      // Arrange
      mockGetSession.mockResolvedValue(null)

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Failed to approve submission: Unauthorized: No active session',
      })

      expect(mockFindUnique).not.toHaveBeenCalled()
      expect(mockGenerateDoctorNotePDF).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    })
  })

  describe('Guardian information handling', () => {
    it('should handle submissions with guardian information (minors)', async () => {
      // Arrange
      const minorSubmission = {
        ...mockSubmission,
        recipient: 'someone_else',
        guardianFirstName: 'Jane',
        guardianLastName: 'Doe',
        guardianDateOfBirth: new Date('1980-05-15'),
      }
      mockFindUnique.mockResolvedValue(minorSubmission)
      mockGenerateDoctorNotePDF.mockResolvedValue(mockPDFBuffer)
      mockGeneratePDFFilename.mockReturnValue(mockPDFFilename)
      mockSendApprovalEmail.mockResolvedValue({ success: true })
      mockUpdate.mockResolvedValue({})

      // Act
      const result = await approveSubmission(mockSubmissionId)

      // Assert
      expect(result).toEqual({ success: true })

      // Verify PDF was generated with guardian info
      expect(mockGenerateDoctorNotePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          guardianFirstName: 'Jane',
          guardianLastName: 'Doe',
          recipient: 'someone_else',
        })
      )
    })
  })
})
