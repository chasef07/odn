'use server'

import { SubmissionStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { toE164UsPhone } from '@/lib/phone-utils'
import { formatDateUTC } from '@/lib/utils'
import { isAtLeastAge } from '@/lib/date-only'
import { getCurrentDoctor } from './shared'

export async function removeGuardianFromAdultSubmission(submissionId: string) {
  try {
    await getCurrentDoctor()

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        patientDateOfBirth: true,
        recipient: true,
        guardianFirstName: true,
        guardianLastName: true,
        guardianDateOfBirth: true,
      },
    })

    if (!submission) {
      return { success: false, error: 'Submission not found' }
    }

    if (!isAtLeastAge(formatDateUTC(submission.patientDateOfBirth), 18)) {
      return {
        success: false,
        error: 'Guardian information is required for patients under 18.',
      }
    }

    const hasGuardianMode =
      submission.recipient === 'someone_else' ||
      Boolean(
        submission.guardianFirstName ||
        submission.guardianLastName ||
        submission.guardianDateOfBirth
      )

    if (!hasGuardianMode) {
      return { success: true }
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        recipient: 'myself',
        guardianFirstName: null,
        guardianLastName: null,
        guardianDateOfBirth: null,
        updatedAt: new Date(),
      },
    })

    revalidatePath('/admin')
    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')
    revalidatePath(`/admin/maybe/${submissionId}`)
    revalidatePath('/admin/search')
    revalidatePath(`/admin/search/${submissionId}`)

    return { success: true }
  } catch (error) {
    logger.error('Error removing guardian mode:', error)
    return { success: false, error: 'Failed to remove guardian mode' }
  }
}

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
    await getCurrentDoctor()

    let updateData: typeof data & {
      smsOptIn?: boolean
      smsOptInAt?: Date | null
      smsConsentVersion?: string | null
      smsPhoneE164?: string | null
    } = data
    if (data.phone !== undefined) {
      const currentSubmission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: {
          phone: true,
          smsOptIn: true,
          smsPhoneE164: true,
        },
      })

      if (!currentSubmission) {
        return { success: false, error: 'Submission not found' }
      }

      const nextSmsPhoneE164 = toE164UsPhone(data.phone)
      const currentSmsPhoneE164 =
        currentSubmission.smsPhoneE164 || toE164UsPhone(currentSubmission.phone)
      const smsNumberChanged = nextSmsPhoneE164 !== currentSmsPhoneE164

      updateData =
        currentSubmission.smsOptIn && !smsNumberChanged
          ? {
              ...data,
              smsPhoneE164: nextSmsPhoneE164,
            }
          : {
              ...data,
              smsOptIn: false,
              smsOptInAt: null,
              smsConsentVersion: null,
              smsPhoneE164: null,
            }
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    })

    revalidatePath('/admin/review')
    revalidatePath('/admin/maybe')
    revalidatePath(`/admin/maybe/${submissionId}`)
    revalidatePath('/admin/search')
    revalidatePath(`/admin/search/${submissionId}`)

    return { success: true }
  } catch (error) {
    logger.error('Error updating submission:', error)
    return { success: false, error: 'Failed to update submission' }
  }
}

export async function updateReviewClassification(
  submissionId: string,
  data: {
    notePurpose: string
    otherNotePurpose: string | null
    absenceReason: string
    otherAbsenceReason: string | null
  }
) {
  try {
    await getCurrentDoctor()

    const result = await prisma.submission.updateMany({
      where: {
        id: submissionId,
        status: SubmissionStatus.PENDING_REVIEW,
      },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    if (result.count === 0) {
      return { success: false, error: 'Submission is no longer pending review' }
    }

    revalidatePath('/admin/review')
    revalidatePath('/admin/search')
    revalidatePath(`/admin/search/${submissionId}`)

    return { success: true }
  } catch (error) {
    logger.error('Error updating review classification:', error)
    return { success: false, error: 'Failed to update classification' }
  }
}
