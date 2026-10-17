import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockResendVerify } = vi.hoisted(() => ({
  mockResendVerify: vi.fn(),
}))

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      webhooks: {
        verify: typeof mockResendVerify
      }
      constructor() {
        this.webhooks = {
          verify: mockResendVerify,
        }
      }
    },
  }
})

const { mockFindLatestSubmissionsForBouncedEmail, mockClaimResendWebhookEvent } = vi.hoisted(
  () => ({
    mockFindLatestSubmissionsForBouncedEmail: vi.fn(),
    mockClaimResendWebhookEvent: vi.fn(),
  })
)

vi.mock('@/db/submissions', () => ({
  findLatestSubmissionsForBouncedEmail: mockFindLatestSubmissionsForBouncedEmail,
}))

vi.mock('@/db/webhook-events', () => ({
  claimResendWebhookEvent: mockClaimResendWebhookEvent,
}))

const { mockSendBounceAlertEmail } = vi.hoisted(() => ({
  mockSendBounceAlertEmail: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendBounceAlertEmail: mockSendBounceAlertEmail,
  resend: {
    webhooks: {
      verify: mockResendVerify,
    },
  },
}))

const { mockSendTransactionalSmsForSubmission } = vi.hoisted(() => ({
  mockSendTransactionalSmsForSubmission: vi.fn(),
}))
vi.mock('@/lib/telnyx', () => ({
  sendTransactionalSmsForSubmission: mockSendTransactionalSmsForSubmission,
}))

import { POST } from '../route'

describe('POST /api/webhooks/resend', () => {
  const mockSubmission = {
    id: 'sub_123',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    email: 'john@example.com',
    phone: '(555) 123-4567',
    smsOptIn: true,
    status: 'APPROVED',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret'
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)
    mockClaimResendWebhookEvent.mockResolvedValue(true)
  })

  it('should return 400 if Svix headers are missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['test@example.com'],
          subject: 'Test',
          bounce_reason: 'mailbox_full',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing webhook headers')
    expect(mockResendVerify).not.toHaveBeenCalled()
  })

  it('should return 400 if signature verification fails', async () => {
    mockResendVerify.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['test@example.com'],
          subject: 'Test',
          bounce_reason: 'mailbox_full',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'invalid_signature',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid signature')
    expect(mockResendVerify).toHaveBeenCalled()
  })

  it('should return 200 for non-bounce events', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.sent',
      data: {
        to: ['test@example.com'],
        subject: 'Test',
      },
    })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.sent',
        data: {
          to: ['test@example.com'],
          subject: 'Test',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(mockFindLatestSubmissionsForBouncedEmail).not.toHaveBeenCalled()
    expect(mockSendBounceAlertEmail).not.toHaveBeenCalled()
  })

  it('should identify approval email from subject', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: "Your Doctor's Note is Approved!",
        bounce_reason: 'mailbox_full',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: "Your Doctor's Note is Approved!",
          bounce_reason: 'mailbox_full',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'john@example.com',
      bounceReason: 'mailbox_full',
      emailType: 'approval',
      submission: mockSubmission,
    })
  })

  it('should identify payment confirmation email from subject', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Payment Confirmed',
        bounce_reason: 'invalid_email',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Payment Confirmed',
          bounce_reason: 'invalid_email',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'john@example.com',
      bounceReason: 'invalid_email',
      emailType: 'payment_confirmation',
      submission: mockSubmission,
    })
  })

  it('sends bounce SMS when the resolved submission is opted in', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Payment Confirmed',
        bounce_reason: 'invalid_email',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })
    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Payment Confirmed',
          bounce_reason: 'invalid_email',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalledWith({
      submission: expect.objectContaining({
        id: 'sub_123',
        phone: '(555) 123-4567',
        smsOptIn: true,
      }),
      type: 'EMAIL_BOUNCE',
      body: expect.stringMatching(/email bounced[\s\S]*Reply HELP[\s\S]*STOP to opt out/),
    })
    expect(mockSendBounceAlertEmail).toHaveBeenCalled()
  })

  it('skips duplicate bounce events before customer SMS', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Payment Confirmed',
        bounce_reason: 'invalid_email',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })
    mockClaimResendWebhookEvent.mockResolvedValue(false)

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Payment Confirmed',
          bounce_reason: 'invalid_email',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockFindLatestSubmissionsForBouncedEmail).not.toHaveBeenCalled()
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
    expect(mockSendBounceAlertEmail).not.toHaveBeenCalled()
  })

  it('keeps the bounce alert flow working when bounce SMS fails', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Payment Confirmed',
        bounce_reason: 'invalid_email',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })
    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendTransactionalSmsForSubmission.mockRejectedValue(new Error('Telnyx unavailable'))
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Payment Confirmed',
          bounce_reason: 'invalid_email',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendBounceAlertEmail).toHaveBeenCalled()
    expect(consoleWarn).toHaveBeenCalledWith(
      'Failed to send transactional SMS (non-critical):',
      expect.objectContaining({
        submissionId: 'sub_123',
        type: 'EMAIL_BOUNCE',
      })
    )

    consoleWarn.mockRestore()
  })

  it('does not send bounce SMS for ambiguous email matches', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Payment Confirmed',
        bounce_reason: 'invalid_email',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })
    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([
      mockSubmission,
      {
        ...mockSubmission,
        id: 'sub_456',
        phone: '(555) 987-6543',
      },
    ])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Payment Confirmed',
          bounce_reason: 'invalid_email',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'john@example.com',
      bounceReason: 'invalid_email',
      emailType: 'payment_confirmation',
      submission: mockSubmission,
    })
  })

  it('should identify denial email from subject', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: "Your Doctor's Note Request - Update",
        bounce_reason: 'mailbox_does_not_exist',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: "Your Doctor's Note Request - Update",
          bounce_reason: 'mailbox_does_not_exist',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'john@example.com',
      bounceReason: 'mailbox_does_not_exist',
      emailType: 'denial',
      submission: mockSubmission,
    })
  })

  it('should identify note follow-up email from subject', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'A thank-you discount from OnlineDoctorNote',
        bounce_reason: 'mailbox_does_not_exist',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.bounced' }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_follow_up',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'john@example.com',
      bounceReason: 'mailbox_does_not_exist',
      emailType: 'follow_up',
      submission: mockSubmission,
    })
  })

  it('should handle unknown email types', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Some Random Email Subject',
        bounce_reason: 'spam',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Some Random Email Subject',
          bounce_reason: 'spam',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'john@example.com',
      bounceReason: 'spam',
      emailType: 'unknown',
      submission: mockSubmission,
    })
  })

  it('should query database with lowercase email', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['JOHN@EXAMPLE.COM'],
        subject: 'Test',
        bounce_reason: 'mailbox_full',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['JOHN@EXAMPLE.COM'],
          subject: 'Test',
          bounce_reason: 'mailbox_full',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    await POST(request)

    expect(mockFindLatestSubmissionsForBouncedEmail).toHaveBeenCalledWith('john@example.com')
  })

  it('should handle missing submission gracefully', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['unknown@example.com'],
        subject: 'Test',
        bounce_reason: 'mailbox_full',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['unknown@example.com'],
          subject: 'Test',
          bounce_reason: 'mailbox_full',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'unknown@example.com',
      bounceReason: 'mailbox_full',
      emailType: 'unknown',
      submission: null,
    })
  })

  it('should handle database errors gracefully', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Test',
        bounce_reason: 'mailbox_full',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockRejectedValue(
      new Error('Database connection failed')
    )
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Test',
          bounce_reason: 'mailbox_full',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'john@example.com',
      bounceReason: 'mailbox_full',
      emailType: 'unknown',
      submission: null,
    })
  })

  it('should return 200 even if alert email fails', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Test',
        bounce_reason: 'mailbox_full',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockRejectedValue(new Error('Email service down'))

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Test',
          bounce_reason: 'mailbox_full',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(data.warning).toBe('Alert email failed')
  })

  it('should handle missing bounce_reason field', async () => {
    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Test',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([mockSubmission])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Test',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSendBounceAlertEmail).toHaveBeenCalledWith({
      bouncedEmail: 'john@example.com',
      bounceReason: 'Unknown reason',
      emailType: 'unknown',
      submission: mockSubmission,
    })
  })

  it('should pass raw body to Resend verification', async () => {
    const rawBody = JSON.stringify({
      type: 'email.bounced',
      data: {
        to: ['john@example.com'],
        subject: 'Test',
        bounce_reason: 'mailbox_full',
      },
    })

    mockResendVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        email_id: 'email_123',
        to: ['john@example.com'],
        subject: 'Test',
        bounce_reason: 'mailbox_full',
        from: 'noreply@onlinedoctornote.com',
        created_at: '2025-01-01T00:00:00Z',
      },
    })

    mockFindLatestSubmissionsForBouncedEmail.mockResolvedValue([])
    mockSendBounceAlertEmail.mockResolvedValue({ id: 'email_sent' })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: rawBody,
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    await POST(request)

    expect(mockResendVerify).toHaveBeenCalledWith({
      payload: rawBody,
      headers: {
        id: 'msg_123',
        timestamp: '1234567890',
        signature: 'valid_signature',
      },
      webhookSecret: 'whsec_test_secret',
    })
  })

  it('should return 500 for unexpected errors', async () => {
    mockResendVerify.mockImplementation(() => {
      throw new Error('Unexpected error')
    })

    const request = new NextRequest('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email.bounced',
        data: {
          to: ['john@example.com'],
          subject: 'Test',
          bounce_reason: 'mailbox_full',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'valid_signature',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid signature')
  })
})
