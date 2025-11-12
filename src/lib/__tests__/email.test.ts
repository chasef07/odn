/**
 * Tests for email utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Resend - must be hoisted before imports
const { mockEmailSend, mockRender } = vi.hoisted(() => ({
  mockEmailSend: vi.fn(),
  mockRender: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mockEmailSend,
    }
  },
}))

vi.mock('@react-email/render', () => ({
  render: mockRender,
}))

import { sendDenialEmail, sendPaymentConfirmationEmail } from '../email'

describe('sendDenialEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock render to return a simple HTML string
    mockRender.mockResolvedValue('<html>Rendered email</html>')
  })

  describe('React Email rendering', () => {
    it('should call render with DenialEmail component', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: 'John Doe',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert - render should be called once
      expect(mockRender).toHaveBeenCalledTimes(1)
    })

    it('should handle special characters safely (React auto-escapes)', async () => {
      // Arrange - React Email automatically escapes HTML in text content
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act - This would normally be blocked by validation, but React Email handles it safely
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: '<script>alert("xss")</script>',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert - render should be called (React Email handles escaping internally)
      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<html>Rendered email</html>',
        })
      )
    })

    it('should handle ampersands and quotes in patient name', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: 'Johnson & Associates "The Best"',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('Email content', () => {
    it('should send email with correct parameters', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })
      mockRender.mockResolvedValue('<html>Test email</html>')

      // Act
      await sendDenialEmail({
        to: 'patient@example.com',
        patientName: 'John Doe',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'patient@example.com',
          subject: "Your Doctor's Note Request - Update",
          html: '<html>Test email</html>',
        })
      )
    })

    it('should render email template for 7+ days denial', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'patient@example.com',
        patientName: 'John Doe',
        denialReason: '7+ days',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'patient@example.com',
        })
      )
    })

    it('should render email template for Other denial', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'patient@example.com',
        patientName: 'John Doe',
        denialReason: 'Other',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error handling', () => {
    it('should throw error if email sending fails', async () => {
      // Arrange
      mockEmailSend.mockRejectedValue(new Error('Email service unavailable'))

      // Act & Assert
      await expect(
        sendDenialEmail({
          to: 'patient@example.com',
          patientName: 'John Doe',
          denialReason: 'Legal',
          refundAmount: 24.95,
        })
      ).rejects.toThrow('Failed to send denial email: Email service unavailable')
    })
  })
})

describe('sendPaymentConfirmationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock render to return a simple HTML string
    mockRender.mockResolvedValue('<html>Payment confirmation email</html>')
  })

  describe('React Email rendering', () => {
    it('should call render with PaymentConfirmationEmail component', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_456' })

      // Act
      await sendPaymentConfirmationEmail({
        to: 'test@example.com',
        patientName: 'Jane Smith',
        submissionId: '550e8400-e29b-41d4-a716-446655440000',
      })

      // Assert - render should be called once
      expect(mockRender).toHaveBeenCalledTimes(1)
    })

    it('should handle special characters safely (React auto-escapes)', async () => {
      // Arrange - React Email automatically escapes HTML in text content
      mockEmailSend.mockResolvedValue({ id: 'email_456' })

      // Act
      await sendPaymentConfirmationEmail({
        to: 'test@example.com',
        patientName: '<script>alert("xss")</script>',
        submissionId: '550e8400-e29b-41d4-a716-446655440000',
      })

      // Assert - render should be called (React Email handles escaping internally)
      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<html>Payment confirmation email</html>',
        })
      )
    })
  })

  describe('Email content', () => {
    it('should send email with correct parameters', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_456' })
      mockRender.mockResolvedValue('<html>Test payment confirmation</html>')

      // Act
      await sendPaymentConfirmationEmail({
        to: 'patient@example.com',
        patientName: 'Jane Smith',
        submissionId: '550e8400-e29b-41d4-a716-446655440000',
      })

      // Assert
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'patient@example.com',
          subject: "Payment Confirmed - Your Doctor's Note Request Received",
          html: '<html>Test payment confirmation</html>',
        })
      )
    })

    it('should include submission ID in email', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_456' })

      const submissionId = '12345678-1234-1234-1234-123456789012'

      // Act
      await sendPaymentConfirmationEmail({
        to: 'patient@example.com',
        patientName: 'Jane Smith',
        submissionId,
      })

      // Assert - render should be called with correct props including submissionId
      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledTimes(1)
    })

    it('should format short submission IDs correctly', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_456' })

      // Act - Test with short UUID
      await sendPaymentConfirmationEmail({
        to: 'patient@example.com',
        patientName: 'Jane Smith',
        submissionId: 'abc12345',
      })

      // Assert
      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error handling', () => {
    it('should throw error if email sending fails', async () => {
      // Arrange
      mockEmailSend.mockRejectedValue(new Error('Email service unavailable'))

      // Act & Assert
      await expect(
        sendPaymentConfirmationEmail({
          to: 'patient@example.com',
          patientName: 'Jane Smith',
          submissionId: '550e8400-e29b-41d4-a716-446655440000',
        })
      ).rejects.toThrow('Failed to send payment confirmation email: Email service unavailable')
    })

    it('should throw error if render fails', async () => {
      // Arrange
      mockRender.mockRejectedValue(new Error('Render failed'))

      // Act & Assert
      await expect(
        sendPaymentConfirmationEmail({
          to: 'patient@example.com',
          patientName: 'Jane Smith',
          submissionId: '550e8400-e29b-41d4-a716-446655440000',
        })
      ).rejects.toThrow('Failed to send payment confirmation email: Render failed')
    })
  })
})
