import { Resend } from 'resend'
import { env } from '@/lib/env'
import { publicEnv } from '@/lib/public-env'
import { render } from '@react-email/render'
import DenialEmail from '@/emails/DenialEmail'
import ApprovalEmail from '@/emails/ApprovalEmail'
import PaymentConfirmationEmail from '@/emails/PaymentConfirmationEmail'
import FollowUpEmail from '@/emails/FollowUpEmail'
import BounceAlertEmail from '@/emails/BounceAlertEmail'
import MaybeEmail from '@/emails/MaybeEmail'
import {
  MORE_INFO_NEEDED_REASON,
  type MaybeApprovedDays,
  type MaybeReason,
} from '@/lib/maybe-reasons'

let resendClient: Resend | null = null

function getResendClient(): Resend {
  resendClient ??= new Resend(env.RESEND_API_KEY)
  return resendClient
}

export const resend = {
  get emails(): Resend['emails'] {
    return getResendClient().emails
  },
  get webhooks(): Resend['webhooks'] {
    return getResendClient().webhooks
  },
}

function throwIfResendFailed(result: unknown): void {
  if (typeof result !== 'object' || result === null || !('error' in result)) return

  const error = (result as { error?: { message?: string } | null }).error
  if (error) {
    throw new Error(error.message || 'Resend rejected the email')
  }
}

const RATE_LIMIT_ATTEMPTS = 4
const DEFAULT_RATE_LIMIT_WAIT_MS = 1000
const MAX_RATE_LIMIT_WAIT_MS = 5000

function rateLimitWaitMs(result: unknown): number | null {
  if (typeof result !== 'object' || result === null || !('error' in result)) return null

  const { error, headers } = result as {
    error?: { name?: string } | null
    headers?: Record<string, string> | null
  }
  if (error?.name !== 'rate_limit_exceeded') return null

  const seconds = Number(headers?.['retry-after'])
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MAX_RATE_LIMIT_WAIT_MS)
    : DEFAULT_RATE_LIMIT_WAIT_MS
}

type SendEmailOptions = Parameters<Resend['emails']['send']>[0]
type SendEmailRequestOptions = Parameters<Resend['emails']['send']>[1]

async function sendEmail(
  label: string,
  buildOptions: () => Promise<SendEmailOptions> | SendEmailOptions,
  requestOptions?: SendEmailRequestOptions
) {
  try {
    const options = await buildOptions()
    const send = () =>
      requestOptions ? resend.emails.send(options, requestOptions) : resend.emails.send(options)

    let result = await send()
    for (let attempt = 1; attempt < RATE_LIMIT_ATTEMPTS; attempt++) {
      const waitMs = rateLimitWaitMs(result)
      if (waitMs === null) break
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      result = await send()
    }
    throwIfResendFailed(result)

    return result
  } catch (error) {
    console.error(`Failed to send ${label}:`, error)
    throw new Error(
      `Failed to send ${label}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function sendDenialEmail({
  to,
  patientName,
  denialReason,
  refundAmount,
}: {
  to: string
  patientName: string
  denialReason: string
  refundAmount: number
}) {
  return sendEmail('denial email', async () => ({
    from: env.RESEND_FROM_EMAIL,
    replyTo: 'hello@onlinedoctornote.com',
    to,
    subject: "Your Doctor's Note Request - Update",
    html: await render(DenialEmail({ patientName, denialReason, refundAmount })),
  }))
}

export async function sendApprovalEmail({
  to,
  patientName,
  notePurpose,
  absenceReason,
  medicalRecordNumber,
  verificationUrl,
  pdfBuffer,
  pdfFilename,
}: {
  to: string
  patientName: string
  notePurpose: string
  absenceReason: string
  medicalRecordNumber?: string
  verificationUrl?: string
  pdfBuffer: Buffer
  pdfFilename: string
}) {
  return sendEmail('approval email', async () => ({
    from: env.RESEND_FROM_EMAIL,
    replyTo: 'hello@onlinedoctornote.com',
    to,
    subject: "Your Doctor's Note is Approved!",
    html: await render(
      ApprovalEmail({
        patientName,
        notePurpose,
        absenceReason,
        medicalRecordNumber,
        verificationUrl,
      })
    ),
    attachments: [{ filename: pdfFilename, content: pdfBuffer }],
  }))
}

export async function sendPaymentConfirmationEmail({
  to,
  patientName,
  submissionId,
}: {
  to: string
  patientName: string
  submissionId: string
}) {
  return sendEmail(
    'payment confirmation email',
    async () => ({
      from: env.RESEND_FROM_EMAIL,
      replyTo: 'hello@onlinedoctornote.com',
      to,
      subject: "Payment Confirmed - Your Doctor's Note Request Received",
      html: await render(PaymentConfirmationEmail({ patientName, submissionId })),
    }),
    { idempotencyKey: `submission/${submissionId}/payment-confirmation` }
  )
}

export async function sendMaybeEmail({
  to,
  patientName,
  reason,
  approvedDays,
}: {
  to: string
  patientName: string
  reason: MaybeReason
  approvedDays?: MaybeApprovedDays | null
}) {
  return sendEmail('maybe email', async () => ({
    from: env.RESEND_FROM_EMAIL,
    replyTo: 'hello@onlinedoctornote.com',
    to,
    subject:
      reason === MORE_INFO_NEEDED_REASON
        ? "More information needed for your doctor's note request"
        : "Update on your doctor's note request",
    html: await render(MaybeEmail({ patientName, reason, approvedDays })),
  }))
}

export async function sendFollowUpEmail({
  to,
  patientName,
  notePurpose,
  submissionId,
}: {
  to: string
  patientName: string
  notePurpose: string
  submissionId: string
}) {
  return sendEmail(
    'follow-up email',
    async () => ({
      from: env.RESEND_FROM_EMAIL,
      replyTo: 'hello@onlinedoctornote.com',
      to,
      subject: 'A thank-you discount from OnlineDoctorNote',
      html: await render(FollowUpEmail({ patientName, notePurpose })),
    }),
    { idempotencyKey: `submission/${submissionId}/note-follow-up` }
  )
}

export async function sendBounceAlertEmail({
  bouncedEmail,
  bounceReason,
  emailType,
  submission,
}: {
  bouncedEmail: string
  bounceReason: string
  emailType: 'approval' | 'denial' | 'payment_confirmation' | 'follow_up' | 'unknown'
  submission: {
    id: string
    patientFirstName: string
    patientLastName: string
    phone: string
    status: string
  } | null
}) {
  return sendEmail('bounce alert email', async () => {
    const emailHtml = await render(
      BounceAlertEmail({
        bouncedEmail,
        bounceReason,
        emailType,
        patientFirstName: submission?.patientFirstName,
        patientLastName: submission?.patientLastName,
        patientPhone: submission?.phone,
        submissionId: submission?.id,
        submissionStatus: submission?.status,
      })
    )
    const patientName = submission
      ? `${submission.patientFirstName} ${submission.patientLastName}`
      : bouncedEmail

    return {
      from: env.RESEND_FROM_EMAIL,
      to: 'hello@onlinedoctornote.com',
      subject: `🚨 Email Bounce Alert: ${patientName}`,
      html: emailHtml,
    }
  })
}

export async function sendSmsSupportTicketAlertEmail({
  ticketId,
  phoneE164,
  category,
  summary,
  submissionId,
}: {
  ticketId: string
  phoneE164: string
  category: string | null
  summary: string
  submissionId?: string | null
}) {
  return sendEmail('SMS support ticket alert email', () => {
    const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL
    const supportUrl = `${siteUrl}/admin/support/${ticketId}`
    const submissionUrl = submissionId ? `${siteUrl}/admin/search/${submissionId}` : null

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2>SMS support ticket needs review</h2>
        <p><strong>Ticket:</strong> ${escapeHtml(ticketId)}</p>
        <p><strong>Category:</strong> ${escapeHtml(category || 'Uncategorized')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phoneE164)}</p>
        <p><strong>Summary:</strong> ${escapeHtml(summary)}</p>
        <p><a href="${supportUrl}">Open support ticket</a></p>
        ${submissionUrl ? `<p><a href="${submissionUrl}">Open submission</a></p>` : ''}
      </div>
    `

    return {
      from: env.RESEND_FROM_EMAIL,
      to: 'hello@onlinedoctornote.com',
      subject: `SMS Support Ticket: ${category || 'Needs Review'}`,
      html: emailHtml,
    }
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
