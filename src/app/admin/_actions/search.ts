'use server'

import { NoteVerificationStatus, Prisma, SubmissionStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { formatDateUTC } from '@/lib/utils'
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
  firstDayOff: string
  lastDayOff: string
  createdAt: Date
  reviewedAt: Date | null
  denialReason: string | null
}

export const getPatientHistory = adminAction(
  async (
    _admin,
    patientFirstName: string,
    patientLastName: string,
    patientDateOfBirth: Date,
    email: string,
    currentSubmissionId: string
  ): Promise<{ success: boolean; data?: PatientHistoryEntry[]; error?: string }> => {
    try {
      const submissions = await prisma.submission.findMany({
        where: {
          id: { not: currentSubmissionId },
          OR: [
            {
              patientFirstName: { equals: patientFirstName, mode: 'insensitive' },
              patientLastName: { equals: patientLastName, mode: 'insensitive' },
              patientDateOfBirth: patientDateOfBirth,
            },
            {
              email: { equals: email, mode: 'insensitive' },
            },
          ],
        },
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
          reviewedAt: true,
          denialReason: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      const formatted: PatientHistoryEntry[] = submissions.map((sub) => ({
        id: sub.id,
        patientFirstName: sub.patientFirstName,
        patientLastName: sub.patientLastName,
        email: sub.email,
        status: sub.status,
        notePurpose: sub.notePurpose,
        firstDayOff: formatDateUTC(sub.firstDayOff),
        lastDayOff: formatDateUTC(sub.lastDayOff),
        createdAt: sub.createdAt,
        reviewedAt: sub.reviewedAt,
        denialReason: sub.denialReason,
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
  firstDayOff: string
  lastDayOff: string
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

      let whereClause: Prisma.SubmissionWhereInput = {}

      switch (searchType) {
        case 'name': {
          const nameParts = trimmedQuery.split(/\s+/)
          if (nameParts.length === 1) {
            whereClause = {
              OR: [
                { patientFirstName: { contains: nameParts[0], mode: 'insensitive' } },
                { patientLastName: { contains: nameParts[0], mode: 'insensitive' } },
              ],
            }
          } else {
            whereClause = {
              AND: [
                { patientFirstName: { contains: nameParts[0], mode: 'insensitive' } },
                {
                  patientLastName: {
                    contains: nameParts[nameParts.length - 1],
                    mode: 'insensitive',
                  },
                },
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
          whereClause = {
            id: { startsWith: trimmedQuery.toLowerCase() },
          }
          break

        case 'medicalRecord': {
          whereClause = {
            noteVerifications: {
              some: {
                medicalRecordNumber: normalizeMedicalRecordNumber(trimmedQuery),
              },
            },
          }
          break
        }

        case 'phone': {
          whereClause = {
            phone: { contains: formatPhoneNumber(trimmedQuery) },
          }
          break
        }
      }

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
      logger.error('Error searching submissions:', error)
      return { success: false, error: 'Failed to search submissions' }
    }
  }
)

type SubmissionWithNoteVerifications = Prisma.SubmissionGetPayload<{
  include: { noteVerifications: true }
}>

export type FormattedSubmission = Omit<
  SubmissionWithNoteVerifications,
  'patientDateOfBirth' | 'guardianDateOfBirth' | 'firstDayOff' | 'lastDayOff' | 'noteVerifications'
> & {
  patientDateOfBirth: string
  guardianDateOfBirth: string | null
  firstDayOff: string
  lastDayOff: string
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
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          noteVerifications: {
            where: {
              status: NoteVerificationStatus.ACTIVE,
              revokedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          smsMessages: {
            select: {
              id: true,
              type: true,
              direction: true,
              providerStatus: true,
              errorCode: true,
              errorMessage: true,
              sentAt: true,
              receivedAt: true,
              finalizedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!submission) {
        return { success: false, error: 'Submission not found' }
      }

      const smsPhoneState = submission.smsPhoneE164
        ? await prisma.smsPhoneState.findUnique({
            where: { phoneE164: submission.smsPhoneE164 },
            select: { optedOutAt: true },
          })
        : null

      const formattedSubmission: FormattedSubmission = {
        ...submission,
        patientDateOfBirth: formatDateUTC(submission.patientDateOfBirth),
        guardianDateOfBirth: submission.guardianDateOfBirth
          ? formatDateUTC(submission.guardianDateOfBirth)
          : null,
        firstDayOff: formatDateUTC(submission.firstDayOff),
        lastDayOff: formatDateUTC(submission.lastDayOff),
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
