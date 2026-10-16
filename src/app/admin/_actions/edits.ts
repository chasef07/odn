'use server'

import { revalidatePath } from 'next/cache'
import {
  findSubmissionGuardianDetails,
  findSubmissionSmsContact,
  removeSubmissionGuardian,
  updatePendingSubmissionClassification,
  updateSubmissionDetails,
} from '@/db/submissions'
import { logger } from '@/lib/logger'
import { toE164UsPhone } from '@/lib/phone-utils'
import { formatDateUTC } from '@/lib/utils'
import { isAtLeastAge } from '@/lib/date-only'
import { adminAction } from '@/lib/admin-session'

export const removeGuardianFromAdultSubmission = adminAction(
  async (_admin, submissionId: string) => {
    try {
      const submission = await findSubmissionGuardianDetails(submissionId)

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

      await removeSubmissionGuardian(submissionId, new Date())

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
)

export const updateSubmission = adminAction(
  async (
    _admin,
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
  ) => {
    try {
      let updateData: typeof data & {
        smsOptIn?: boolean
        smsOptInAt?: Date | null
        smsConsentVersion?: string | null
        smsPhoneE164?: string | null
      } = data
      if (data.phone !== undefined) {
        const currentSubmission = await findSubmissionSmsContact(submissionId)

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

      await updateSubmissionDetails(submissionId, updateData, new Date())

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
)

export const updateReviewClassification = adminAction(
  async (
    _admin,
    submissionId: string,
    data: {
      notePurpose: string
      otherNotePurpose: string | null
      absenceReason: string
      otherAbsenceReason: string | null
    }
  ) => {
    try {
      const updatedCount = await updatePendingSubmissionClassification(
        submissionId,
        data,
        new Date()
      )

      if (updatedCount === 0) {
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
)
