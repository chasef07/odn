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
import { getBusinessDayStart } from '@/lib/admin-utils'

// Export shared submission types for components
export type MaybeSubmission = Awaited<ReturnType<typeof getMaybeSubmissions>>['submissions'][number]
export type ManualSubmission = Awaited<ReturnType<typeof getManualSubmissions>>['submissions'][number]

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
    // Business day starts at 6am ET (not midnight UTC)
    const today = getBusinessDayStart()

    const [pendingCount, approvedToday, deniedToday, maybeCount, manualCount] = await Promise.all([
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

      // Manual (all time)
      prisma.submission.count({
        where: { status: SubmissionStatus.MANUAL },
      }),
    ])

    return {
      success: true,
      data: {
        pendingCount,
        approvedToday,
        deniedToday,
        maybeCount,
        manualCount,
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
    // Business day starts at 6am ET (not midnight UTC)
    const today = getBusinessDayStart()

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
    // Business day starts at 6am ET (not midnight UTC)
    const today = getBusinessDayStart()

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
 * @param firstDayOff - First day of absence request
 * @param lastDayOff - Last day of absence request
 * @returns Monthly usage data
 */
export async function getMonthlyLimitData(
  email: string,
  firstDayOff: Date,
  lastDayOff: Date
) {
  try {
    // Use the existing utility function
    const result = await wouldExceedMonthlyLimit(email, firstDayOff, lastDayOff)

    return { success: true, data: result }
  } catch (error) {
    console.error('Error getting monthly limit data:', error)
    return { success: false, error: 'Failed to calculate monthly limit' }
  }
}

/**
 * Approve a submission with PDF generation and email notification
 * @param submissionId - Submission ID to approve
 * @param evaluationDate - Optional date string (YYYY-MM-DD) for the PDF "Date Issued" field
 * @param diagnosis - Optional diagnosis text to include in the PDF
 * @param withRestrictions - Whether to include ", with no restrictions" text in PDF (defaults to true)
 * @returns Success status with detailed error messages
 */
export async function approveSubmission(submissionId: string, evaluationDate?: string, diagnosis?: string, withRestrictions: boolean = true) {
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
    // Parse evaluation date if provided (for custom "Date Issued" on PDF)
    let issueDate: Date | undefined = undefined
    if (evaluationDate) {
      const [year, month, day] = evaluationDate.split('-').map(Number)
      // Create UTC date to match PDF template's formatDate() which uses getUTCMonth/getUTCDate
      issueDate = new Date(Date.UTC(year, month - 1, day))
    }

    // Step 2: Generate PDF (BLOCKING - must succeed)
    let pdfBuffer: Buffer
    let pdfFilename: string
    try {
      pdfBuffer = await generateDoctorNotePDF(submission, issueDate, diagnosis, withRestrictions)
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

// Type for search result submissions
export type SearchSubmission = {
  id: string
  patientFirstName: string
  patientLastName: string
  email: string
  status: SubmissionStatus
  notePurpose: string
  firstDayOff: string
  lastDayOff: string
  createdAt: Date
}

/**
 * Search submissions by name, email, or ID
 * @param query - Search query string
 * @param searchType - Type of search: 'name', 'email', or 'id'
 * @param page - Page number (1-indexed)
 * @param limit - Results per page
 * @returns Paginated search results
 */
export async function searchSubmissions({
  query,
  searchType,
  page = 1,
  limit = 10,
}: {
  query: string
  searchType: 'name' | 'email' | 'id'
  page?: number
  limit?: number
}): Promise<{
  success: boolean
  submissions?: SearchSubmission[]
  total?: number
  error?: string
}> {
  try {
    await getCurrentDoctor() // Verify authentication

    if (!query || query.trim().length === 0) {
      return { success: true, submissions: [], total: 0 }
    }

    const skip = (page - 1) * limit
    const trimmedQuery = query.trim()

    // Build where clause based on search type
    let whereClause: Prisma.SubmissionWhereInput = {}

    switch (searchType) {
      case 'name': {
        // Split query into parts for flexible matching
        const nameParts = trimmedQuery.split(/\s+/)
        if (nameParts.length === 1) {
          // Single term: search both first and last name
          whereClause = {
            OR: [
              { patientFirstName: { contains: nameParts[0], mode: 'insensitive' } },
              { patientLastName: { contains: nameParts[0], mode: 'insensitive' } },
            ],
          }
        } else {
          // Multiple terms: first matches firstName, last matches lastName
          whereClause = {
            AND: [
              { patientFirstName: { contains: nameParts[0], mode: 'insensitive' } },
              { patientLastName: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' } },
            ],
          }
        }
        break
      }

      case 'email':
        whereClause = {
          email: { contains: trimmedQuery.toLowerCase(), mode: 'insensitive' },
        }
        break

      case 'id':
        // Support both full UUID and partial ID (prefix match)
        whereClause = {
          id: { startsWith: trimmedQuery.toLowerCase() },
        }
        break
    }

    // Execute search with pagination
    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where: whereClause,
        select: {
          id: true,
          patientFirstName: true,
          patientLastName: true,
          email: true,
          status: true,
          notePurpose: true,
          firstDayOff: true,
          lastDayOff: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.submission.count({ where: whereClause }),
    ])

    // Format dates consistently using UTC components
    const formatDateUTC = (date: Date): string => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const formattedSubmissions: SearchSubmission[] = submissions.map((sub) => ({
      id: sub.id,
      patientFirstName: sub.patientFirstName,
      patientLastName: sub.patientLastName,
      email: sub.email,
      status: sub.status,
      notePurpose: sub.notePurpose,
      firstDayOff: formatDateUTC(sub.firstDayOff),
      lastDayOff: formatDateUTC(sub.lastDayOff),
      createdAt: sub.createdAt,
    }))

    return { success: true, submissions: formattedSubmissions, total }
  } catch (error) {
    console.error('Error searching submissions:', error)
    return { success: false, error: 'Failed to search submissions' }
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
    revalidatePath('/admin/search')
    revalidatePath(`/admin/search/${submissionId}`)

    return { success: true }
  } catch (error) {
    console.error('Error updating submission:', error)
    return { success: false, error: 'Failed to update submission' }
  }
}

/**
 * Re-approve an already approved submission (generates new PDF and sends new email)
 * Use this when edits were made to an approved submission and a new note is needed
 * @param submissionId - Submission ID to re-approve
 * @param evaluationDate - Optional date string (YYYY-MM-DD) for the PDF "Date Issued" field
 * @param diagnosis - Optional diagnosis text to include in the PDF
 * @param withRestrictions - Whether to include ", with no restrictions" text in PDF (defaults to true)
 * @returns Success status with optional warning
 */
export async function reApproveSubmission(submissionId: string, evaluationDate?: string, diagnosis?: string, withRestrictions: boolean = true) {
  try {
    const doctorId = await getCurrentDoctor()

    // Fetch submission
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    // Parse evaluation date if provided (for custom "Date Issued" on PDF)
    let issueDate: Date | undefined = undefined
    if (evaluationDate) {
      const [year, month, day] = evaluationDate.split('-').map(Number)
      // Create UTC date to match PDF template's formatDate() which uses getUTCMonth/getUTCDate
      issueDate = new Date(Date.UTC(year, month - 1, day))
    }

    // Generate new PDF (BLOCKING - must succeed)
    let pdfBuffer: Buffer
    let pdfFilename: string
    try {
      pdfBuffer = await generateDoctorNotePDF(submission, issueDate, diagnosis, withRestrictions)
      pdfFilename = generatePDFFilename(submission.id)

      if (process.env.NODE_ENV === 'development') {
        console.log(`Re-approval: PDF generated: ${pdfFilename} for submission ${submissionId}`)
      }
    } catch (pdfError) {
      console.error('Re-approval PDF generation failed:', pdfError)
      return {
        success: false,
        error: `Failed to generate PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
      }
    }

    // Send new approval email (NON-BLOCKING)
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
        console.log(`Re-approval email sent to ${submission.email} for submission ${submissionId}`)
      }
    } catch (emailError) {
      console.error('Re-approval email failed:', emailError)
      emailWarning = 'Re-approval processed, but email notification failed to send'
    }

    // Update database
    const now = new Date()
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        approvalEmailSentAt: emailSentAt,
        updatedAt: now,
      },
    })

    // Revalidate pages
    revalidatePath('/admin')
    revalidatePath('/admin/search')
    revalidatePath(`/admin/search/${submissionId}`)
    revalidatePath('/admin/approved')

    if (emailWarning) {
      return { success: true, warning: emailWarning }
    }

    return { success: true }
  } catch (error) {
    console.error('Error re-approving submission:', error)
    return {
      success: false,
      error: `Failed to re-approve submission: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Change submission status with appropriate handling for each transition
 * Handles complex cases like denying after approval (check refund status)
 * @param submissionId - Submission ID to change
 * @param newStatus - Target status
 * @param denialReason - Required if newStatus is DENIED
 * @returns Success status with optional warning
 */
export async function changeSubmissionStatus(
  submissionId: string,
  newStatus: SubmissionStatus,
  denialReason?: string
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    const doctorId = await getCurrentDoctor()

    // Fetch current submission
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    const currentStatus = submission.status
    const now = new Date()

    // Handle different status transitions
    switch (newStatus) {
      case SubmissionStatus.APPROVED: {
        // For approval, use the regular approveSubmission or reApproveSubmission
        // This function handles simpler status changes
        return { success: false, error: 'Use approveSubmission or reApproveSubmission for approvals' }
      }

      case SubmissionStatus.DENIED: {
        if (!denialReason) {
          return { success: false, error: 'Denial reason is required' }
        }

        // Check if already denied
        if (currentStatus === SubmissionStatus.DENIED) {
          return { success: false, error: 'Submission is already denied' }
        }

        // Check if refund already processed
        const alreadyRefunded = !!submission.stripeRefundId

        if (alreadyRefunded) {
          // Already refunded - just update status and send email
          await prisma.submission.update({
            where: { id: submissionId },
            data: {
              status: SubmissionStatus.DENIED,
              denialReason,
              reviewedByAdminId: doctorId,
              reviewedAt: now,
              updatedAt: now,
            },
          })

          // Try to send denial email (NON-BLOCKING)
          let emailWarning: string | undefined
          try {
            const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
            // Note: Can't get refund amount since it's already processed, use 0
            await sendDenialEmail({
              to: submission.email,
              patientName,
              denialReason,
              refundAmount: 0, // Already refunded previously
            })
          } catch {
            emailWarning = 'Status changed but email notification failed to send'
          }

          revalidatePath('/admin')
          revalidatePath('/admin/search')
          revalidatePath(`/admin/search/${submissionId}`)
          revalidatePath('/admin/denied')

          return {
            success: true,
            warning: emailWarning || 'Submission denied. Note: Refund was already processed previously.',
          }
        }

        // Need to process refund
        if (!submission.stripePaymentIntentId) {
          return { success: false, error: 'No payment intent ID found for this submission' }
        }

        // Process refund
        const idempotencyKey = `refund_${submissionId}_${doctorId}_change`
        let refund: Stripe.Refund

        try {
          refund = await stripe.refunds.create(
            {
              payment_intent: submission.stripePaymentIntentId,
              reason: 'requested_by_customer',
              metadata: {
                submissionId: submission.id,
                denialReason,
                processedBy: 'admin-status-change',
              },
            },
            { idempotencyKey }
          )
        } catch (stripeError) {
          console.error('Refund failed during status change:', stripeError)
          return {
            success: false,
            error: `Failed to process refund: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`,
          }
        }

        // Update database with refund info
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: SubmissionStatus.DENIED,
            denialReason,
            reviewedByAdminId: doctorId,
            reviewedAt: now,
            stripeRefundId: refund.id,
            refundedAt: now,
            updatedAt: now,
          },
        })

        // Send denial email (NON-BLOCKING)
        let emailWarning: string | undefined
        try {
          const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
          const refundAmountDollars = refund.amount / 100
          await sendDenialEmail({
            to: submission.email,
            patientName,
            denialReason,
            refundAmount: refundAmountDollars,
          })
        } catch {
          emailWarning = 'Submission denied and refunded, but email notification failed to send'
        }

        revalidatePath('/admin')
        revalidatePath('/admin/search')
        revalidatePath(`/admin/search/${submissionId}`)
        revalidatePath('/admin/denied')

        return { success: true, warning: emailWarning }
      }

      case SubmissionStatus.MAYBE: {
        // Simple status change to MAYBE
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: SubmissionStatus.MAYBE,
            reviewedByAdminId: doctorId,
            reviewedAt: now,
            updatedAt: now,
          },
        })

        revalidatePath('/admin')
        revalidatePath('/admin/search')
        revalidatePath(`/admin/search/${submissionId}`)
        revalidatePath('/admin/maybe')

        return { success: true }
      }

      case SubmissionStatus.MANUAL: {
        // Simple status change to MANUAL
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: SubmissionStatus.MANUAL,
            reviewedByAdminId: doctorId,
            reviewedAt: now,
            updatedAt: now,
          },
        })

        revalidatePath('/admin')
        revalidatePath('/admin/search')
        revalidatePath(`/admin/search/${submissionId}`)
        revalidatePath('/admin/maybe')

        return { success: true }
      }

      case SubmissionStatus.PENDING_REVIEW: {
        // Allow moving back to pending (rare case)
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: SubmissionStatus.PENDING_REVIEW,
            reviewedByAdminId: null,
            reviewedAt: null,
            updatedAt: now,
          },
        })

        revalidatePath('/admin')
        revalidatePath('/admin/search')
        revalidatePath(`/admin/search/${submissionId}`)
        revalidatePath('/admin/review')

        return { success: true }
      }

      default:
        return { success: false, error: `Unknown status: ${newStatus}` }
    }
  } catch (error) {
    console.error('Error changing submission status:', error)
    return {
      success: false,
      error: `Failed to change status: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}
