import { Resend } from 'resend'
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
  const apiKey =
    process.env.RESEND_API_KEY || (process.env.NODE_ENV === 'test' ? 're_test_key' : '')
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required to use Resend email')
  }

  resendClient ??= new Resend(apiKey)
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

// Email configuration
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@onlinedoctornote.com'

function throwIfResendFailed(result: unknown): void {
  if (typeof result !== 'object' || result === null || !('error' in result)) return

  const error = (result as { error?: { message?: string } | null }).error
  if (error) {
    throw new Error(error.message || 'Resend rejected the email')
  }
}

/**
 * Sends a denial notification email to the patient
 *
 * @param to - Recipient email address
 * @param patientName - Patient's full name
 * @param denialReason - Reason for denial (Legal, 7+ days, Other)
 * @param refundAmount - Amount refunded (in dollars)
 * @returns Promise that resolves to the email send result
 * @throws Error if email sending fails
 */
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
  try {
    // Render the React Email component to HTML
    const emailHtml = await render(
      DenialEmail({
        patientName,
        denialReason,
        refundAmount,
      })
    )

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: 'hello@onlinedoctornote.com',
      to,
      subject: "Your Doctor's Note Request - Update",
      html: emailHtml,
    })
    throwIfResendFailed(result)

    return result
  } catch (error) {
    console.error('Failed to send denial email:', error)
    throw new Error(
      `Failed to send denial email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Sends an approval notification email to the patient with PDF attachment
 *
 * @param to - Recipient email address
 * @param patientName - Patient's full name
 * @param notePurpose - Purpose of the note (work, school, both, other)
 * @param pdfBuffer - PDF file as Buffer
 * @param pdfFilename - Filename for the PDF attachment
 * @returns Promise that resolves to the email send result
 * @throws Error if email sending fails
 */
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
  try {
    // Render the React Email component to HTML
    const emailHtml = await render(
      ApprovalEmail({
        patientName,
        notePurpose,
        absenceReason,
        medicalRecordNumber,
        verificationUrl,
      })
    )

    // Send email with PDF attachment
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: 'hello@onlinedoctornote.com',
      to,
      subject: "Your Doctor's Note is Approved!",
      html: emailHtml,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
        },
      ],
    })
    throwIfResendFailed(result)

    return result
  } catch (error) {
    console.error('Failed to send approval email:', error)
    throw new Error(
      `Failed to send approval email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Sends a payment confirmation email to the patient
 *
 * @param to - Recipient email address
 * @param patientName - Patient's full name
 * @param submissionId - Unique submission ID (UUID)
 * @returns Promise that resolves to the email send result
 * @throws Error if email sending fails
 */
export async function sendPaymentConfirmationEmail({
  to,
  patientName,
  submissionId,
}: {
  to: string
  patientName: string
  submissionId: string
}) {
  try {
    // Render the React Email component to HTML
    const emailHtml = await render(
      PaymentConfirmationEmail({
        patientName,
        submissionId,
      })
    )

    const result = await resend.emails.send(
      {
        from: FROM_EMAIL,
        replyTo: 'hello@onlinedoctornote.com',
        to,
        subject: "Payment Confirmed - Your Doctor's Note Request Received",
        html: emailHtml,
      },
      {
        idempotencyKey: `submission/${submissionId}/payment-confirmation`,
      }
    )
    throwIfResendFailed(result)

    return result
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error)
    throw new Error(
      `Failed to send payment confirmation email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Sends a maybe review update email to the patient
 *
 * @param to - Recipient email address
 * @param patientName - Patient's full name
 * @param reason - Maybe reason that drives the email body
 * @param approvedDays - Number of days approved for date-range maybe emails
 * @returns Promise that resolves to the email send result
 * @throws Error if email sending fails
 */
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
  try {
    const emailHtml = await render(
      MaybeEmail({
        patientName,
        reason,
        approvedDays,
      })
    )

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: 'hello@onlinedoctornote.com',
      to,
      subject:
        reason === MORE_INFO_NEEDED_REASON
          ? "More information needed for your doctor's note request"
          : "Update on your doctor's note request",
      html: emailHtml,
    })
    throwIfResendFailed(result)

    return result
  } catch (error) {
    console.error('Failed to send maybe email:', error)
    throw new Error(
      `Failed to send maybe email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Sends the single post-delivery customer follow-up for a submission.
 *
 * The caller owns eligibility and persistence. The stable submission-scoped
 * idempotency key makes a retry safe if the job loses its database acknowledgement.
 */
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
  try {
    const emailHtml = await render(
      FollowUpEmail({
        patientName,
        notePurpose,
      })
    )

    const result = await resend.emails.send(
      {
        from: FROM_EMAIL,
        replyTo: 'hello@onlinedoctornote.com',
        to,
        subject: 'A thank-you discount from OnlineDoctorNote',
        html: emailHtml,
      },
      {
        idempotencyKey: `submission/${submissionId}/note-follow-up`,
      }
    )
    throwIfResendFailed(result)

    return result
  } catch (error) {
    console.error('Failed to send follow-up email:', error)
    throw new Error(
      `Failed to send follow-up email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Sends a bounce alert email to the admin team
 *
 * @param bouncedEmail - Email address that bounced
 * @param bounceReason - Reason for the bounce
 * @param emailType - Type of email that bounced
 * @param submission - Submission data (optional)
 * @returns Promise that resolves to the email send result
 * @throws Error if email sending fails
 */
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
  try {
    // Render the React Email component to HTML
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

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: 'hello@onlinedoctornote.com',
      subject: `🚨 Email Bounce Alert: ${patientName}`,
      html: emailHtml,
    })
    throwIfResendFailed(result)

    return result
  } catch (error) {
    console.error('Failed to send bounce alert email:', error)
    throw new Error(
      `Failed to send bounce alert email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
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
  try {
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.BETTER_AUTH_URL ||
      'https://onlinedoctornote.com'
    ).replace(/\/+$/, '')
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

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: 'hello@onlinedoctornote.com',
      subject: `SMS Support Ticket: ${category || 'Needs Review'}`,
      html: emailHtml,
    })
    throwIfResendFailed(result)
    return result
  } catch (error) {
    console.error('Failed to send SMS support ticket alert email:', error)
    throw new Error(
      `Failed to send SMS support ticket alert email: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
