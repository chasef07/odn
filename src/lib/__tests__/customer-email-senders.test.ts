import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEmailSend, mockRender } = vi.hoisted(() => ({
  mockEmailSend: vi.fn(),
  mockRender: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockEmailSend }
  },
}))

vi.mock('@react-email/render', () => ({ render: mockRender }))

import {
  sendApprovalEmail,
  sendDenialEmail,
  sendFollowUpEmail,
  sendPaymentConfirmationEmail,
} from '../email'

describe('customer lifecycle email sender contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRender.mockResolvedValue('<html>rendered</html>')
    mockEmailSend.mockResolvedValue({ data: { id: 'email_123' }, error: null })
  })

  it('sends purchase confirmation to the payer with support reply-to and no attachment', async () => {
    await sendPaymentConfirmationEmail({
      to: 'customer@example.com',
      patientName: 'Lily',
      submissionId: 'sub_123',
    })

    expect(mockEmailSend).toHaveBeenCalledWith(
      {
        from: 'noreply@onlinedoctornote.com',
        replyTo: 'hello@onlinedoctornote.com',
        to: 'customer@example.com',
        subject: "Payment Confirmed - Your Doctor's Note Request Received",
        html: '<html>rendered</html>',
      },
      { idempotencyKey: 'submission/sub_123/payment-confirmation' }
    )
  })

  it('sends the approved note to the submission email with the generated PDF attached', async () => {
    const pdfBuffer = Buffer.from('pdf')

    await sendApprovalEmail({
      to: 'customer@example.com',
      patientName: 'Cinda Seibert',
      notePurpose: 'work',
      absenceReason: 'Feeling sick',
      pdfBuffer,
      pdfFilename: 'doctors-note-sub_123.pdf',
    })

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'hello@onlinedoctornote.com',
        to: 'customer@example.com',
        subject: "Your Doctor's Note is Approved!",
        attachments: [{ filename: 'doctors-note-sub_123.pdf', content: pdfBuffer }],
      })
    )
  })

  it('sends the denial/refund update to the submission email', async () => {
    await sendDenialEmail({
      to: 'customer@example.com',
      patientName: 'Javeon Sydnor',
      denialReason: '7+ days',
      refundAmount: 24.95,
    })

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'hello@onlinedoctornote.com',
        to: 'customer@example.com',
        subject: "Your Doctor's Note Request - Update",
      })
    )
  })

  it('sends the follow-up with a stable submission idempotency key', async () => {
    await sendFollowUpEmail({
      to: 'customer@example.com',
      patientName: 'Alex Doe',
      notePurpose: 'work',
      submissionId: 'sub_123',
    })

    expect(mockEmailSend).toHaveBeenCalledWith(
      {
        from: 'noreply@onlinedoctornote.com',
        replyTo: 'hello@onlinedoctornote.com',
        to: 'customer@example.com',
        subject: 'A thank-you discount from OnlineDoctorNote',
        html: '<html>rendered</html>',
      },
      { idempotencyKey: 'submission/sub_123/note-follow-up' }
    )
  })

  it('treats a provider error response as a failed send', async () => {
    mockEmailSend.mockResolvedValue({
      data: null,
      error: { message: 'provider rejected request' },
    })

    await expect(
      sendFollowUpEmail({
        to: 'customer@example.com',
        patientName: 'Alex Doe',
        notePurpose: 'work',
        submissionId: 'sub_123',
      })
    ).rejects.toThrow('Failed to send follow-up email: provider rejected request')
  })
})
