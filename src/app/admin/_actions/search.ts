'use server'

import { findSmsPhoneOptOut } from '@/db/sms-support'
import {
  findPatientHistory,
  findSubmissionForAdminDetail,
  searchSubmissionsPage,
  type SubmissionSearch,
} from '@/db/submissions'
import type { DenialReason, NoteVerification, Submission, SubmissionStatus } from '@/db/types'
import { logger } from '@/lib/logger'
import { dateOnlyFromUtcDate, parseDateOnly, utcDateFromDateOnly, type DateOnly } from '@/lib/dates'
import { formatPhoneNumber } from '@/lib/phone-utils'
import { getVerificationUrl, normalizeMedicalRecordNumber } from '@/lib/note-verification'
import { adminAction } from '@/lib/admin-session'

export type FormattedSmsMessage = {
  id: string
  type: string
  direction: string
  providerStatus: string | null
  errorCode: string | null
  errorMessage: string | null
  sentAt: Date | null
  receivedAt: Date | null
  finalizedAt: Date | null
  createdAt: Date | null
}

export type PatientHistoryEntry = {
  id: string
  patientFirstName: string
  patientLastName: string
  email: string
  status: SubmissionStatus
  notePurpose: string
  firstDayOff: DateOnly
  lastDayOff: DateOnly
  createdAt: Date
  reviewedAt: Date | null
  denialReason: DenialReason | null
  denialNote: string | null
}

export const getPatientHistory = adminAction(
  async (
    _admin,
    patientFirstName: string,
    patientLastName: string,
    patientDateOfBirth: string,
    email: string,
    currentSubmissionId: string
  ): Promise<{ success: boolean; data?: PatientHistoryEntry[]; error?: string }> => {
    const dateOfBirth = parseDateOnly(patientDateOfBirth)
    if (!dateOfBirth) return { success: false, error: 'Expected a YYYY-MM-DD date of birth' }
    try {
      const submissions = await findPatientHistory({
        patientFirstName,
        patientLastName,
        patientDateOfBirth: utcDateFromDateOnly(dateOfBirth),
        email,
        excludeSubmissionId: currentSubmissionId,
      })

      const formatted: PatientHistoryEntry[] = submissions.map((sub) => ({
        id: sub.id,
        patientFirstName: sub.patientFirstName,
        patientLastName: sub.patientLastName,
        email: sub.email,
        status: sub.status,
        notePurpose: sub.notePurpose,
        firstDayOff: dateOnlyFromUtcDate(sub.firstDayOff),
        lastDayOff: dateOnlyFromUtcDate(sub.lastDayOff),
        createdAt: sub.createdAt,
        reviewedAt: sub.reviewedAt,
        denialReason: sub.denialReason,
        denialNote: sub.denialNote,
      }))

      return { success: true, data: formatted }
    } catch (error) {
      logger.error('Error fetching patient history:', error)
      return { success: false, error: 'Failed to fetch patient history' }
    }
  }
)

export type SearchSubmission = {
  id: string
  patientFirstName: string
  patientLastName: string
  email: string
  status: SubmissionStatus
  notePurpose: string
  firstDayOff: DateOnly
  lastDayOff: DateOnly
  createdAt: Date
}

export type AdminSearchType = 'name' | 'email' | 'id' | 'phone' | 'medicalRecord'

export const searchSubmissions = adminAction(
  async (
    _admin,
    {
      query,
      searchType,
      page = 1,
      limit = 10,
    }: {
      query: string
      searchType: AdminSearchType
      page?: number
      limit?: number
    }
  ): Promise<{
    success: boolean
    submissions?: SearchSubmission[]
    total?: number
    error?: string
  }> => {
    try {
      if (!query || query.trim().length === 0) {
        return { success: true, submissions: [], total: 0 }
      }

      const skip = (page - 1) * limit
      const trimmedQuery = query.trim()

      let search: SubmissionSearch | null = null

      switch (searchType) {
        case 'name': {
          const nameParts = trimmedQuery.split(/\s+/)
          if (nameParts.length === 1) {
            search = { by: 'anyName', term: nameParts[0] }
          } else {
            search = {
              by: 'fullName',
              firstName: nameParts[0],
              lastName: nameParts[nameParts.length - 1],
            }
          }
          break
        }

        case 'email':
          search = { by: 'email', term: trimmedQuery.toLowerCase() }
          break

        case 'id':
          search = { by: 'idPrefix', prefix: trimmedQuery.toLowerCase() }
          break

        case 'medicalRecord': {
          search = {
            by: 'medicalRecordNumber',
            medicalRecordNumber: normalizeMedicalRecordNumber(trimmedQuery),
          }
          break
        }

        case 'phone': {
          search = { by: 'phone', term: formatPhoneNumber(trimmedQuery) }
          break
        }
      }

      const { submissions, total } = await searchSubmissionsPage(search, { skip, take: limit })

      const formattedSubmissions: SearchSubmission[] = submissions.map((sub) => ({
        id: sub.id,
        patientFirstName: sub.patientFirstName,
        patientLastName: sub.patientLastName,
        email: sub.email,
        status: sub.status,
        notePurpose: sub.notePurpose,
        firstDayOff: dateOnlyFromUtcDate(sub.firstDayOff),
        lastDayOff: dateOnlyFromUtcDate(sub.lastDayOff),
        createdAt: sub.createdAt,
      }))

      return { success: true, submissions: formattedSubmissions, total }
    } catch (error) {
      logger.error('Error searching submissions:', error)
      return { success: false, error: 'Failed to search submissions' }
    }
  }
)

type SubmissionWithNoteVerifications = Submission & {
  noteVerifications: NoteVerification[]
}

export type FormattedSubmission = Omit<
  SubmissionWithNoteVerifications,
  'patientDateOfBirth' | 'guardianDateOfBirth' | 'firstDayOff' | 'lastDayOff' | 'noteVerifications'
> & {
  patientDateOfBirth: DateOnly
  guardianDateOfBirth: DateOnly | null
  firstDayOff: DateOnly
  lastDayOff: DateOnly
  noteVerifications: Array<
    SubmissionWithNoteVerifications['noteVerifications'][number] & { verificationUrl: string }
  >
  smsMessages: FormattedSmsMessage[]
  smsOptOutAt: Date | null
  smsPhoneE164: string | null
}

export const getSubmissionById = adminAction(
  async (
    _admin,
    submissionId: string
  ): Promise<
    { success: true; submission: FormattedSubmission } | { success: false; error: string }
  > => {
    try {
      const submission = await findSubmissionForAdminDetail(submissionId)

      if (!submission) {
        return { success: false, error: 'Submission not found' }
      }

      const smsPhoneState = submission.smsPhoneE164
        ? await findSmsPhoneOptOut(submission.smsPhoneE164)
        : null

      const formattedSubmission: FormattedSubmission = {
        ...submission,
        patientDateOfBirth: dateOnlyFromUtcDate(submission.patientDateOfBirth),
        guardianDateOfBirth: submission.guardianDateOfBirth
          ? dateOnlyFromUtcDate(submission.guardianDateOfBirth)
          : null,
        firstDayOff: dateOnlyFromUtcDate(submission.firstDayOff),
        lastDayOff: dateOnlyFromUtcDate(submission.lastDayOff),
        noteVerifications: submission.noteVerifications.map((verification) => ({
          ...verification,
          verificationUrl: getVerificationUrl(verification.verificationSlug),
        })),
        smsMessages: submission.smsMessages,
        smsOptOutAt: smsPhoneState?.optedOutAt || null,
        smsPhoneE164: submission.smsPhoneE164,
      }

      return {
        success: true,
        submission: formattedSubmission,
      }
    } catch (error) {
      logger.error('Error fetching submission:', error)
      return { success: false, error: 'Failed to fetch submission' }
    }
  }
)
