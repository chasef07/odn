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
 * Get approved submissions for today
 * @returns Array of approved submissions with name, email, and approval timestamp
 */
export async function getApprovedSubmissionsForToday() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.APPROVED,
        reviewedAt: { gte: today },
      },
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        email: true,
        approvalEmailSentAt: true,
      },
      orderBy: {
        approvalEmailSentAt: 'desc', // Newest first
      },
    })

    return { success: true, data: submissions }
  } catch (error) {
    console.error('Error fetching approved submissions:', error)
    return { success: false, error: 'Failed to fetch approved submissions' }
  }
}

/**
 * Get denied submissions for today
 * @returns Array of denied submissions with name, email, and denial timestamp
 */
export async function getDeniedSubmissionsForToday() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.DENIED,
        reviewedAt: { gte: today },
      },
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        email: true,
        denialEmailSentAt: true,
      },
      orderBy: {
        denialEmailSentAt: 'desc', // Newest first
      },
    })

    return { success: true, data: submissions }
  } catch (error) {
    console.error('Error fetching denied submissions:', error)
    return { success: false, error: 'Failed to fetch denied submissions' }
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

    // Allow approval from PENDING_REVIEW, MAYBE, or MANUAL status
    if (
      submission.status !== SubmissionStatus.PENDING_REVIEW &&
      submission.status !== SubmissionStatus.MAYBE &&
      submission.status !== SubmissionStatus.MANUAL
    ) {
      return {
        success: false,
        error: `Cannot approve submission with status: ${submission.status}`
      }
    }

    // Check if this is a manual approval (skip automation)
    const isManual = submission.status === SubmissionStatus.MANUAL

    if (isManual) {
      // Manual approval: Skip PDF generation and email sending
      const now = new Date()
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.APPROVED,
          reviewedByAdminId: doctorId,
          reviewedAt: now,
          approvalEmailSentAt: null, // No email sent for manual approvals
        },
      })

      // Revalidate admin pages
      revalidatePath('/admin')
      revalidatePath('/admin/review')
      revalidatePath('/admin/maybe')

      if (process.env.NODE_ENV === 'development') {
        console.log(`Manual approval completed for submission ${submissionId}`)
      }

      return { success: true }
    }

    // Standard approval: Generate PDF and send email
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

    // Allow denial from PENDING_REVIEW, MAYBE, or MANUAL status
    if (
      submission.status !== SubmissionStatus.PENDING_REVIEW &&
      submission.status !== SubmissionStatus.MAYBE &&
      submission.status !== SubmissionStatus.MANUAL
    ) {
      return {
        success: false,
        error: `Cannot deny submission with status: ${submission.status}`
      }
    }

    // Check if this is a manual denial (skip automation)
    const isManual = submission.status === SubmissionStatus.MANUAL

    if (isManual) {
      // Manual denial: Skip refund processing and email sending
      const now = new Date()
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.DENIED,
          denialReason: reason,
          reviewedByAdminId: doctorId,
          reviewedAt: now,
          denialEmailSentAt: null, // No email sent for manual denials
          // No refund fields set (stripeRefundId, refundedAt remain null)
        },
      })

      // Revalidate admin pages
      revalidatePath('/admin')
      revalidatePath('/admin/review')
      revalidatePath('/admin/maybe')
      revalidatePath('/admin/denied')

      if (process.env.NODE_ENV === 'development') {
        console.log(`Manual denial completed for submission ${submissionId}`)
      }

      return { success: true }
    }

    // Standard denial: Process refund and send email

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

    // Step 2: Update database FIRST (with optimistic locking to prevent race conditions)
    // This prevents two doctors from denying the same submission simultaneously
    const now = new Date()
    const updateResult = await prisma.submission.updateMany({
      where: {
        id: submissionId,
        status: {
          in: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
        },
        stripeRefundId: null, // Only if not already refunded
      },
      data: {
        status: SubmissionStatus.DENIED,
        denialReason: reason,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        stripeRefundId: `pending_${submissionId}`, // Placeholder - will be replaced after refund
        refundedAt: now,
      },
    })

    // If no rows were updated, another doctor already reviewed this
    if (updateResult.count === 0) {
      return {
        success: false,
        error: 'This submission has already been reviewed by another doctor',
      }
    }

    // Step 3: Process Stripe refund (BLOCKING - must succeed)
    // FIX 2: Add idempotency key to prevent duplicate refunds on network retry
    let refund: Stripe.Refund
    const idempotencyKey = `refund_${submissionId}_${doctorId}`

    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: submission.stripePaymentIntentId,
          reason: 'requested_by_customer',
          metadata: {
            submissionId: submission.id,
            denialReason: reason,
            processedBy: 'admin-denial-automation',
          },
        },
        {
          idempotencyKey: idempotencyKey, // Prevents duplicate refunds on retry (24h cache)
        }
      )

      if (process.env.NODE_ENV === 'development') {
        console.log(`Refund processed: ${refund.id} for submission ${submissionId}`)
      }
    } catch (stripeError) {
      // CRITICAL: Refund failed - rollback database status
      console.error('Stripe refund failed:', stripeError)

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.PENDING_REVIEW, // Rollback to original status
          stripeRefundId: null,
          reviewedByAdminId: null,
          reviewedAt: null,
          refundedAt: null,
          denialReason: null,
        },
      })

      return {
        success: false,
        error: `Failed to process refund: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`
      }
    }

    // Step 4: Update database with actual refund ID (replace placeholder)
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        stripeRefundId: refund.id, // Replace placeholder with real Stripe refund ID
      },
    })

    // Step 5: Send denial email (NON-BLOCKING - log error but don't fail)
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

    // Step 6: Update email timestamp if email succeeded
    if (emailSentAt) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          denialEmailSentAt: emailSentAt, // Only set if email succeeded
        },
      })
    }

    // Revalidate admin pages
    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')
    revalidatePath('/admin/denied')

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
 * Mark a submission as manual (doctor will handle note manually)
 * @param submissionId - Submission ID to mark as manual
 * @returns Success status
 */
export async function markAsManual(submissionId: string) {
  try {
    const doctorId = await getCurrentDoctor()

    // Verify submission is in MAYBE status
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { status: true },
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    if (submission.status !== SubmissionStatus.MAYBE) {
      return {
        success: false,
        error: `Can only mark MAYBE submissions as manual, current status: ${submission.status}`
      }
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.MANUAL,
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
    console.error('Error marking submission as manual:', error)
    return { success: false, error: 'Failed to mark submission as manual' }
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
        email: true,
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
        email: sub.email,
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

/**
 * Get all submissions with MANUAL status
 * @returns Array of manual submissions with patient info
 */
export async function getManualSubmissions() {
  try {
    await getCurrentDoctor() // Verify authentication

    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.MANUAL,
      },
      select: {
        id: true,
        patientFirstName: true,
        patientLastName: true,
        email: true,
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
        email: sub.email,
        firstDayOff: formatDateUTC(sub.firstDayOff),
        lastDayOff: formatDateUTC(sub.lastDayOff),
        reviewedAt: sub.reviewedAt,
      }
    })

    return { success: true, submissions: formattedSubmissions }
  } catch (error) {
    console.error('Error fetching manual submissions:', error)
    return { success: false, error: 'Failed to fetch manual submissions', submissions: [] }
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
