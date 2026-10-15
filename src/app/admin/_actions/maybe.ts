'use server'

import { SubmissionStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { type MaybeApprovedDays, type MaybeReason } from '@/lib/maybe-reasons'
import { getCurrentDoctor, moveSubmissionToMaybe } from './shared'

export type MaybeSubmissionInput = {
  reason: MaybeReason | string
  internalNote?: string
  approvedDays?: MaybeApprovedDays | number
}

export async function maybeSubmission(submissionId: string, input: MaybeSubmissionInput) {
  try {
    const doctorId = await getCurrentDoctor()

    return await moveSubmissionToMaybe({
      submissionId,
      doctorId,
      input,
      revalidatePaths: ['/admin', '/admin/review', '/admin/maybe'],
    })
  } catch (error) {
    logger.error('Error marking submission as maybe:', error)
    return { success: false, error: 'Failed to mark submission as maybe' }
  }
}

export async function markAsManual(submissionId: string) {
  try {
    const doctorId = await getCurrentDoctor()

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
        error: `Can only mark MAYBE submissions as manual, current status: ${submission.status}`,
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

    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')

    return { success: true }
  } catch (error) {
    logger.error('Error marking submission as manual:', error)
    return { success: false, error: 'Failed to mark submission as manual' }
  }
}
