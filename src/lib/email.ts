import { Resend } from 'resend'
import { render } from '@react-email/render'
import DenialEmail from '@/emails/DenialEmail'
import ApprovalEmail from '@/emails/ApprovalEmail'
import PaymentConfirmationEmail from '@/emails/PaymentConfirmationEmail'
import BounceAlertEmail from '@/emails/BounceAlertEmail'

// Initialize Resend client with API key from environment
export const resend = new Resend(process.env.RESEND_API_KEY)

// Email configuration
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@onlinedoctornote.com'

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
  pdfBuffer,
  pdfFilename,
}: {
  to: string
  patientName: string
  notePurpose: string
  absenceReason: string
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

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: 'hello@onlinedoctornote.com',
      to,
      subject: "Payment Confirmed - Your Doctor's Note Request Received",
      html: emailHtml,
    })

    return result
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error)
    throw new Error(
      `Failed to send payment confirmation email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Sends a bounce alert email to the admin team
 *
 * @param bouncedEmail - Email address that bounced
 * @param bounceReason - Reason for the bounce
 * @param emailType - Type of email that bounced (approval, denial, payment_confirmation, unknown)
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
  emailType: 'approval' | 'denial' | 'payment_confirmation' | 'unknown'
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

    return result
  } catch (error) {
    console.error('Failed to send bounce alert email:', error)
    throw new Error(
      `Failed to send bounce alert email: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

