/**
 * Admin Server Actions
 * Handle all admin review operations with database persistence
 */

'use server'

import { SubmissionStatus } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth'
import { revalidatePath } from 'next/cache'
import { wouldExceedMonthlyLimit } from '@/lib/monthly-limit'
import prisma from '@/lib/prisma'

/**
 * Get current logged-in doctor's session
 */
async function getCurrentDoctor() {
  const session = await getServerSession(authOptions)
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
 * Approve a submission
 * @param submissionId - Submission ID to approve
 * @returns Success status
 */
export async function approveSubmission(submissionId: string) {
  try {
    const doctorId = await getCurrentDoctor()

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedByAdminId: doctorId,
        reviewedAt: new Date(),
      },
    })

    // Revalidate admin pages
    revalidatePath('/admin')
    revalidatePath('/admin/review')

    return { success: true }
  } catch (error) {
    console.error('Error approving submission:', error)
    return { success: false, error: 'Failed to approve submission' }
  }
}

/**
 * Deny a submission with reason
 * @param submissionId - Submission ID to deny
 * @param reason - Denial reason
 * @returns Success status
 */
export async function denySubmission(submissionId: string, reason: string) {
  try {
    const doctorId = await getCurrentDoctor()

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.DENIED,
        denialReason: reason,
        reviewedByAdminId: doctorId,
        reviewedAt: new Date(),
      },
    })

    // Revalidate admin pages
    revalidatePath('/admin')
    revalidatePath('/admin/review')

    return { success: true }
  } catch (error) {
    console.error('Error denying submission:', error)
    return { success: false, error: 'Failed to deny submission' }
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

    return { success: true }
  } catch (error) {
    console.error('Error marking submission as maybe:', error)
    return { success: false, error: 'Failed to mark submission as maybe' }
  }
}
