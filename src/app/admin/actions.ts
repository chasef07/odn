/**
 * Admin Server Actions
 * Handle all admin review operations with database persistence
 */

'use server'

import { Prisma, SubmissionStatus } from '@prisma/client'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { wouldExceedMonthlyLimit } from '@/lib/monthly-limit'
import prisma from '@/lib/prisma'
import Stripe from 'stripe'
import { sendDenialEmail, sendApprovalEmail } from '@/lib/email'
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})


/**
 * Get current logged-in doctor's session
 */
async function getCurrentDoctor() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  if (!session?.user?.id) {
    throw new Error('Unauthorized: No active session')
  }
  return session.user.id
}

/**
 * Get all pending submissions for review
 * @returns Array of submissions with PENDING_REVIEW status, oldest first
 */
export async function getSubmissionsForReview() {
  try {
    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.PENDING_REVIEW,
      },
      orderBy: {
        createdAt: 'asc', // FIFO - oldest first
      },
    })

    return { success: true, data: submissions }
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return { success: false, error: 'Failed to fetch submissions' }
  }
}

/**
 * Get dashboard statistics
 * @returns Counts for pending, approved today, denied today, maybe
 */
export async function getDashboardStats() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [pendingCount, approvedToday, deniedToday, maybeCount] = await Promise.all([
      // Pending reviews
      prisma.submission.count({
        where: { status: SubmissionStatus.PENDING_REVIEW },
      }),

      // Approved today
      prisma.submission.count({
        where: {
          status: SubmissionStatus.APPROVED,
          reviewedAt: { gte: today },
        },
      }),

      // Denied today
      prisma.submission.count({
        where: {
          status: SubmissionStatus.DENIED,
          reviewedAt: { gte: today },
        },
      }),

      // Maybe (all time)
      prisma.submission.count({
        where: { status: SubmissionStatus.MAYBE },
      }),
    ])

    return {
      success: true,
      data: {
        pendingCount,
        approvedToday,
        deniedToday,
        maybeCount,
      },
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return { success: false, error: 'Failed to fetch dashboard stats' }
  }
}

/**
 * Get monthly limit data for a patient
 * @param email - Patient email
 * @param referenceDate - Date to check (usually first day off)
 * @returns Monthly usage data
 */
export async function getMonthlyLimitData(email: string, referenceDate: Date) {
  try {
    // Use the existing utility function
    const result = await wouldExceedMonthlyLimit(
      email,
      referenceDate,
      referenceDate // For single day, use same date
    )

    return { success: true, data: result }
  } catch (error) {
    console.error('Error getting monthly limit data:', error)
    return { success: false, error: 'Failed to calculate monthly limit' }
  }
}

/**
 * Approve a submission with PDF generation and email notification
 * @param submissionId - Submission ID to approve
 * @returns Success status with detailed error messages
 */
export async function approveSubmission(submissionId: string) {
  try {
    const doctorId = await getCurrentDoctor()

    // Step 1: Fetch submission to get status and patient details
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    // Allow approval from PENDING_REVIEW or MAYBE status
    if (submission.status !== SubmissionStatus.PENDING_REVIEW && submission.status !== SubmissionStatus.MAYBE) {
      return {
        success: false,
        error: `Cannot approve submission with status: ${submission.status}`
      }
    }

    // Step 2: Generate PDF (BLOCKING - must succeed)
    let pdfBuffer: Buffer
    let pdfFilename: string
    try {
      pdfBuffer = await generateDoctorNotePDF(submission)
      pdfFilename = generatePDFFilename(submission.id)

      if (process.env.NODE_ENV === 'development') {
        console.log(`PDF generated: ${pdfFilename} for submission ${submissionId}`)
      }
    } catch (pdfError) {
      // PDF generation failed - DO NOT approve submission
      console.error('PDF generation failed:', pdfError)
      return {
        success: false,
        error: `Failed to generate PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`
      }
    }

    // Step 3: Send approval email with PDF attachment (NON-BLOCKING - log warning if fails)
    const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
    let emailSentAt: Date | undefined
    let emailWarning: string | undefined

    try {
      await sendApprovalEmail({
        to: submission.email,
        patientName,
        notePurpose: submission.notePurpose,
        absenceReason: submission.absenceReason,
        pdfBuffer,
        pdfFilename,
      })
      emailSentAt = new Date()

      if (process.env.NODE_ENV === 'development') {
        console.log(`Approval email sent to ${submission.email} for submission ${submissionId}`)
      }
    } catch (emailError) {
      // Email failed but PDF generated successfully - log error but continue
      console.error('Failed to send approval email:', emailError)
      emailWarning = 'Submission approved, but email notification failed to send'
    }

    // Step 4: Single atomic database update with all fields
    const now = new Date()
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        approvalEmailSentAt: emailSentAt, // Only set if email succeeded
      },
    })

    // Revalidate admin pages
    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')

    // Return success with optional warning
    if (emailWarning) {
      return { success: true, warning: emailWarning }
    }

    return { success: true }
  } catch (error) {
    console.error('Error approving submission:', error)
    return {
      success: false,
      error: `Failed to approve submission: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Deny a submission with reason, process refund, and send email notification
 * @param submissionId - Submission ID to deny
 * @param reason - Denial reason (Legal, 7+ days, Other)
 * @returns Success status with detailed error messages
 */
export async function denySubmission(submissionId: string, reason: string) {
  try {
    const doctorId = await getCurrentDoctor()

    // Step 1: Fetch submission to get payment intent ID and patient details
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        stripePaymentIntentId: true,
        stripeRefundId: true,
        email: true,
        patientFirstName: true,
        patientLastName: true,
        status: true,
      },
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    // Allow denial from PENDING_REVIEW or MAYBE status
    if (submission.status !== SubmissionStatus.PENDING_REVIEW && submission.status !== SubmissionStatus.MAYBE) {
      return {
        success: false,
        error: `Cannot deny submission with status: ${submission.status}`
      }
    }

    if (!submission.stripePaymentIntentId) {
      return {
        success: false,
        error: 'No payment intent ID found for this submission'
      }
    }

    // Idempotency check: Prevent duplicate refunds
    if (submission.stripeRefundId) {
      return {
        success: false,
        error: 'Refund already processed for this submission'
      }
    }

    // Step 2: Process Stripe refund (BLOCKING - must succeed)
    let refund: Stripe.Refund
    try {
      refund = await stripe.refunds.create({
        payment_intent: submission.stripePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          submissionId: submission.id,
          denialReason: reason,
          processedBy: 'admin-denial-automation',
        },
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`Refund processed: ${refund.id} for submission ${submissionId}`)
      }
    } catch (stripeError) {
      // Refund failed - DO NOT update submission status
      console.error('Stripe refund failed:', stripeError)
      return {
        success: false,
        error: `Failed to process refund: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`
      }
    }

    // Step 3: Send denial email FIRST (NON-BLOCKING - log error but don't fail)
    const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
    const refundAmountDollars = refund.amount / 100 // Convert cents to dollars from Stripe refund
    let emailSentAt: Date | undefined
    let emailWarning: string | undefined

    try {
      await sendDenialEmail({
        to: submission.email,
        patientName,
        denialReason: reason,
        refundAmount: refundAmountDollars,
      })
      emailSentAt = new Date()

      if (process.env.NODE_ENV === 'development') {
        console.log(`Denial email sent to ${submission.email} for submission ${submissionId}`)
      }
    } catch (emailError) {
      // Email failed but refund succeeded - log error but continue
      console.error('Failed to send denial email:', emailError)
      emailWarning = 'Submission denied and refunded, but email notification failed to send'
    }

    // Step 4: Single atomic database update with all fields
    const now = new Date()
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.DENIED,
        denialReason: reason,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        stripeRefundId: refund.id,
        refundedAt: now,
        denialEmailSentAt: emailSentAt, // Only set if email succeeded
      },
    })

    // Revalidate admin pages
    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')

    // Return success with optional warning
    if (emailWarning) {
      return { success: true, warning: emailWarning }
    }

    return { success: true }
  } catch (error) {
    console.error('Error denying submission:', error)
    return {
      success: false,
      error: `Failed to deny submission: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Mark a submission as maybe (needs further review)
 * @param submissionId - Submission ID to mark as maybe
 * @returns Success status
 */
export async function maybeSubmission(submissionId: string) {
  try {
    const doctorId = await getCurrentDoctor()

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.MAYBE,
        reviewedByAdminId: doctorId,
        reviewedAt: new Date(),
      },
    })

    // Revalidate admin pages
    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')

    return { success: true }
  } catch (error) {
    console.error('Error marking submission as maybe:', error)
    return { success: false, error: 'Failed to mark submission as maybe' }
  }
}

/**
 * Get all submissions with MAYBE status
 * @returns Array of maybe submissions with patient info
 */
export async function getMaybeSubmissions() {
  try {
    await getCurrentDoctor() // Verify authentication

    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.MAYBE,
      },
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        firstDayOff: true,
        lastDayOff: true,
        reviewedAt: true,
      },
      orderBy: {
        reviewedAt: 'desc', // Most recent first
      },
    })

    // Format dates consistently using UTC components to avoid timezone shifts
    const formattedSubmissions = submissions.map((sub) => {
      const formatDateUTC = (date: Date) => {
        const year = date.getUTCFullYear()
        const month = String(date.getUTCMonth() + 1).padStart(2, '0')
        const day = String(date.getUTCDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      return {
        id: sub.id,
        patientFirstName: sub.patientFirstName,
        patientLastName: sub.patientLastName,
        firstDayOff: formatDateUTC(sub.firstDayOff),
        lastDayOff: formatDateUTC(sub.lastDayOff),
        reviewedAt: sub.reviewedAt,
      }
    })

    return { success: true, submissions: formattedSubmissions }
  } catch (error) {
    console.error('Error fetching maybe submissions:', error)
    return { success: false, error: 'Failed to fetch maybe submissions', submissions: [] }
  }
}

// Type for submission with formatted date strings (for client components)
export type FormattedSubmission = Omit<
  Prisma.SubmissionGetPayload<object>,
  'patientDateOfBirth' | 'guardianDateOfBirth' | 'firstDayOff' | 'lastDayOff'
> & {
  patientDateOfBirth: string
  guardianDateOfBirth: string | null
  firstDayOff: string
  lastDayOff: string
}

/**
 * Get single submission by ID for editing
 * @param submissionId - Submission ID to fetch
 * @returns Full submission data with dates formatted consistently
 */
export async function getSubmissionById(submissionId: string): Promise<
  | { success: true; submission: FormattedSubmission }
  | { success: false; error: string }
> {
  try {
    await getCurrentDoctor() // Verify authentication

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    // Format dates consistently using UTC components to avoid timezone shifts
    const formatDateUTC = (date: Date): string => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Return submission with formatted date fields
    const formattedSubmission: FormattedSubmission = {
      ...submission,
      patientDateOfBirth: formatDateUTC(submission.patientDateOfBirth),
      guardianDateOfBirth: submission.guardianDateOfBirth ? formatDateUTC(submission.guardianDateOfBirth) : null,
      firstDayOff: formatDateUTC(submission.firstDayOff),
      lastDayOff: formatDateUTC(submission.lastDayOff),
    }

    return {
      success: true,
      submission: formattedSubmission,
    }
  } catch (error) {
    console.error('Error fetching submission:', error)
    return { success: false, error: 'Failed to fetch submission' }
  }
}

/**
 * Update submission fields (keeps status as MAYBE)
 * @param submissionId - Submission ID to update
 * @param data - Updated submission data
 * @returns Success status
 */
export async function updateSubmission(
  submissionId: string,
  data: {
    patientFirstName?: string
    patientLastName?: string
    patientDateOfBirth?: Date
    guardianFirstName?: string | null
    guardianLastName?: string | null
    guardianDateOfBirth?: Date | null
    email?: string
    phone?: string
    state?: string
    notePurpose?: string
    otherNotePurpose?: string | null
    firstDayOff?: Date
    lastDayOff?: Date
    absenceReason?: string
    otherAbsenceReason?: string | null
    symptoms?: string[]
    otherSymptomText?: string | null
    additionalInformation?: string | null
  }
) {
  try {
    await getCurrentDoctor() // Verify authentication

    // Update submission with new values, keep status as MAYBE
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    // Revalidate admin pages
    revalidatePath('/admin/maybe')
    revalidatePath(`/admin/maybe/${submissionId}`)

    return { success: true }
  } catch (error) {
    console.error('Error updating submission:', error)
    return { success: false, error: 'Failed to update submission' }
  }
}
