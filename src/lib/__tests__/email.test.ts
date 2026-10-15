import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { sendDenialEmail, sendMaybeEmail, sendPaymentConfirmationEmail } from '../email'

describe('sendDenialEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRender.mockResolvedValue('<html>Rendered email</html>')
  })

  describe('React Email rendering', () => {
    it('should call render with DenialEmail component', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      await sendDenialEmail({
        to: 'test@example.com',
        patientName: 'John Doe',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
    })

    it('should handle special characters safely (React auto-escapes)', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      await sendDenialEmail({
        to: 'test@example.com',
        patientName: '<script>alert("xss")</script>',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<html>Rendered email</html>',
        })
      )
    })

    it('should handle ampersands and quotes in patient name', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      await sendDenialEmail({
        to: 'test@example.com',
        patientName: 'Johnson & Associates "The Best"',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('Email content', () => {
    it('should send email with correct parameters', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_123' })
      mockRender.mockResolvedValue('<html>Test email</html>')

      await sendDenialEmail({
        to: 'patient@example.com',
        patientName: 'John Doe',
        denialReason: 'Legal',
        refundAmount: 24.95,
      })

      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'patient@example.com',
          subject: "Your Doctor's Note Request - Update",
          html: '<html>Test email</html>',
        })
      )
    })

    it('should render email template for 7+ days denial', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      await sendDenialEmail({
        to: 'patient@example.com',
        patientName: 'John Doe',
        denialReason: '7+ days',
        refundAmount: 24.95,
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'patient@example.com',
        })
      )
    })

    it('should render email template for Other denial', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_123' })

      await sendDenialEmail({
        to: 'patient@example.com',
        patientName: 'John Doe',
        denialReason: 'Other',
        refundAmount: 24.95,
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error handling', () => {
    it('should throw error if email sending fails', async () => {
      mockEmailSend.mockRejectedValue(new Error('Email service unavailable'))

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

describe('sendMaybeEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRender.mockResolvedValue('<html>Maybe email</html>')
  })

  it('should send a maybe update email with correct parameters', async () => {
    mockEmailSend.mockResolvedValue({ id: 'email_789' })

    await sendMaybeEmail({
      to: 'patient@example.com',
      patientName: 'John Doe',
      reason: 'DATES_EXCEED_ALLOWED_RANGE',
      approvedDays: 3,
    })

    expect(mockRender).toHaveBeenCalledTimes(1)
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'patient@example.com',
        subject: "Update on your doctor's note request",
        html: '<html>Maybe email</html>',
      })
    )
  })

  it('should throw error if maybe email sending fails', async () => {
    mockEmailSend.mockRejectedValue(new Error('Email service unavailable'))

    await expect(
      sendMaybeEmail({
        to: 'patient@example.com',
        patientName: 'John Doe',
        reason: 'OTHER_REVIEW',
      })
    ).rejects.toThrow('Failed to send maybe email: Email service unavailable')
  })

  it('uses a specific non-sensitive subject and the existing support reply address for more info', async () => {
    mockEmailSend.mockResolvedValue({ id: 'email_more_info' })

    await sendMaybeEmail({
      to: 'patient@example.com',
      patientName: 'John Doe',
      reason: 'MORE_INFO_NEEDED',
    })

    expect(mockEmailSend).toHaveBeenCalledTimes(1)
    expect(mockEmailSend).toHaveBeenCalledWith({
      from: 'noreply@onlinedoctornote.com',
      replyTo: 'hello@onlinedoctornote.com',
      to: 'patient@example.com',
      subject: "More information needed for your doctor's note request",
      html: '<html>Maybe email</html>',
    })
  })
})

describe('sendPaymentConfirmationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRender.mockResolvedValue('<html>Payment confirmation email</html>')
  })

  describe('React Email rendering', () => {
    it('should call render with PaymentConfirmationEmail component', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_456' })

      await sendPaymentConfirmationEmail({
        to: 'test@example.com',
        patientName: 'Jane Smith',
        submissionId: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
    })

    it('should handle special characters safely (React auto-escapes)', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_456' })

      await sendPaymentConfirmationEmail({
        to: 'test@example.com',
        patientName: '<script>alert("xss")</script>',
        submissionId: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<html>Payment confirmation email</html>',
        }),
        expect.objectContaining({
          idempotencyKey: 'submission/550e8400-e29b-41d4-a716-446655440000/payment-confirmation',
        })
      )
    })
  })

  describe('Email content', () => {
    it('should send email with correct parameters', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_456' })
      mockRender.mockResolvedValue('<html>Test payment confirmation</html>')

      await sendPaymentConfirmationEmail({
        to: 'patient@example.com',
        patientName: 'Jane Smith',
        submissionId: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'patient@example.com',
          subject: "Payment Confirmed - Your Doctor's Note Request Received",
          html: '<html>Test payment confirmation</html>',
        }),
        expect.objectContaining({
          idempotencyKey: 'submission/550e8400-e29b-41d4-a716-446655440000/payment-confirmation',
        })
      )
    })

    it('should include submission ID in email', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_456' })

      const submissionId = '12345678-1234-1234-1234-123456789012'

      await sendPaymentConfirmationEmail({
        to: 'patient@example.com',
        patientName: 'Jane Smith',
        submissionId,
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledTimes(1)
    })

    it('should format short submission IDs correctly', async () => {
      mockEmailSend.mockResolvedValue({ id: 'email_456' })

      await sendPaymentConfirmationEmail({
        to: 'patient@example.com',
        patientName: 'Jane Smith',
        submissionId: 'abc12345',
      })

      expect(mockRender).toHaveBeenCalledTimes(1)
      expect(mockEmailSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error handling', () => {
    it('should throw error if email sending fails', async () => {
      mockEmailSend.mockRejectedValue(new Error('Email service unavailable'))

      await expect(
        sendPaymentConfirmationEmail({
          to: 'patient@example.com',
          patientName: 'Jane Smith',
          submissionId: '550e8400-e29b-41d4-a716-446655440000',
        })
      ).rejects.toThrow('Failed to send payment confirmation email: Email service unavailable')
    })

    it('should throw error if render fails', async () => {
      mockRender.mockRejectedValue(new Error('Render failed'))

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
