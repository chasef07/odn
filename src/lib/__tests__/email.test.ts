/**
 * Tests for email utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Resend - must be hoisted before imports
const { mockEmailSend } = vi.hoisted(() => ({
  mockEmailSend: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mockEmailSend,
    }
  },
}))

import { sendDenialEmail } from '../email'

describe('sendDenialEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('HTML escaping (XSS prevention)', () => {
    it('should escape HTML special characters in patient name', async () => {
      // Arrange - Malicious name with HTML tags
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act - This would normally be blocked by validation, but we test escaping anyway
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: '<script>alert("xss")</script>',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert - HTML should be escaped
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'),
        })
      )
    })

    it('should escape ampersands in patient name', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: 'Johnson & Associates',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Johnson &amp; Associates'),
        })
      )
    })

    it('should escape single quotes in patient name', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: "O'Brien",
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('O&#039;Brien'),
        })
      )
    })

    it('should escape double quotes in patient name', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: 'John "The Rock" Johnson',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('John &quot;The Rock&quot; Johnson'),
        })
      )
    })

    it('should escape less-than and greater-than symbols', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: 'Amount < 100 > 50',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Amount &lt; 100 &gt; 50'),
        })
      )
    })

    it('should handle normal names without escaping issues', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      // Act
      await sendDenialEmail({
        to: 'test@example.com',
        patientName: 'John Doe',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      // Assert
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Dear John Doe,'),
        })
      )
    })
  })

  describe('Email content', () => {
    it('should send email with correct denial reason for Legal', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

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
          html: expect.stringContaining('due to legal or compliance requirements'),
        })
      )
    })

    it('should send email with correct denial reason for 7+ days', async () => {
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
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('because the absence period exceeds our 7-day limit'),
        })
      )
    })

    it('should send email with correct denial reason for Other', async () => {
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
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('after careful review of your submission'),
        })
      )
    })

    it('should format refund amount as currency', async () => {
      // Arrange
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

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
          html: expect.stringContaining('$24.95'),
        })
      )
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
