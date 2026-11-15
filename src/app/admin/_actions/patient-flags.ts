'use server'

import { findPatientFlag, flagPatient, unflagPatient } from '@/db/patient-flags'
import { findSubmissionById, type PatientIdentity } from '@/db/submissions'
import type { PatientFlag } from '@/db/types'
import { adminAction } from '@/lib/admin-session'
import { now } from '@/lib/dates'
import { logger } from '@/lib/logger'

const MAX_FLAG_REASON_LENGTH = 500

type PatientFlagResult =
  { success: true; flag: PatientFlag | null } | { success: false; error: string }

async function patientOf(submissionId: string): Promise<PatientIdentity | null> {
  const submission = await findSubmissionById(submissionId)
  if (!submission) return null
  return {
    patientFirstName: submission.patientFirstName,
    patientLastName: submission.patientLastName,
    patientDateOfBirth: submission.patientDateOfBirth,
  }
}

export const getPatientFlag = adminAction(
  async (_admin, submissionId: string): Promise<PatientFlagResult> => {
    try {
      const patient = await patientOf(submissionId)
      if (!patient) return { success: false, error: 'Submission not found' }
      return { success: true, flag: await findPatientFlag(patient) }
    } catch (error) {
      logger.error('Error loading patient flag:', error)
      return { success: false, error: 'Failed to load patient flag' }
    }
  }
)

export const setPatientFlag = adminAction(
  async (admin, submissionId: string, reason: string): Promise<PatientFlagResult> => {
    const trimmed = reason.trim()
    if (trimmed.length > MAX_FLAG_REASON_LENGTH) {
      return {
        success: false,
        error: `Keep the reason to ${MAX_FLAG_REASON_LENGTH} characters or fewer`,
      }
    }
    try {
      const patient = await patientOf(submissionId)
      if (!patient) return { success: false, error: 'Submission not found' }
      const flag = await flagPatient(patient, {
        reason: trimmed || null,
        flaggedBy: admin.email,
        flaggedAt: now(),
      })
      return { success: true, flag }
    } catch (error) {
      logger.error('Error flagging patient:', error)
      return { success: false, error: 'Failed to flag patient' }
    }
  }
)

export const clearPatientFlag = adminAction(
  async (_admin, submissionId: string): Promise<PatientFlagResult> => {
    try {
      const patient = await patientOf(submissionId)
      if (!patient) return { success: false, error: 'Submission not found' }
      await unflagPatient(patient)
      return { success: true, flag: null }
    } catch (error) {
      logger.error('Error unflagging patient:', error)
      return { success: false, error: 'Failed to unflag patient' }
    }
  }
)
