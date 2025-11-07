import { Resend } from 'resend'

// Initialize Resend client with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY)

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
    // Map internal denial reasons to user-friendly messages
    const reasonMessages = {
      Legal: 'due to legal or compliance requirements',
      '7+ days': 'because the absence period exceeds our 7-day limit',
      Other: 'after careful review of your submission',
    }

    const denialReasonMessage =
      reasonMessages[denialReason as keyof typeof reasonMessages] ||
      reasonMessages.Other

    // Format refund amount as currency
    const formattedRefund = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(refundAmount)

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Your Doctor\'s Note Request - Update',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Doctor's Note Request Update</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
              <h1 style="color: #dc3545; margin-top: 0;">Doctor's Note Request Update</h1>

              <p>Dear ${patientName},</p>

              <p>We regret to inform you that your doctor's note request has been <strong>denied</strong> ${denialReasonMessage}.</p>

              <div style="background-color: #fff; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #28a745;">Refund Processed</h3>
                <p style="margin-bottom: 0;">A full refund of <strong>${formattedRefund}</strong> has been processed to your original payment method. Please allow 5-10 business days for the refund to appear in your account.</p>
              </div>

              <h3>What happens next?</h3>
              <p>If you believe this denial was made in error or if you have questions about the reason for denial, please contact our support team. We're here to help.</p>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <p style="color: #6c757d; font-size: 14px; margin-bottom: 0;">
                  <strong>Need Help?</strong><br>
                  If you have any questions, please contact our support team at <a href="mailto:support@onlinedoctornote.com" style="color: #007bff;">support@onlinedoctornote.com</a>
                </p>
              </div>
            </div>

            <div style="text-align: center; color: #6c757d; font-size: 12px; margin-top: 20px;">
              <p>© ${new Date().getFullYear()} Online Doctor's Note. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
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
 * Validates that required email environment variables are set
 * @throws Error if required environment variables are missing
 */
export function validateEmailConfig() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is required')
  }
  if (!process.env.RESEND_FROM_EMAIL) {
    console.warn(
      'RESEND_FROM_EMAIL not set, using default: noreply@onlinedoctornote.com'
    )
  }
}
