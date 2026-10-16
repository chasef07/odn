import { Prisma } from '@prisma/client'
import prisma from './client'
import { NoteVerificationStatus, type NoteVerification, type Submission } from './types'

export type NewNoteVerification = Pick<
  NoteVerification,
  | 'submissionId'
  | 'medicalRecordNumber'
  | 'verificationSlug'
  | 'issueDate'
  | 'patientInitials'
  | 'firstDayOff'
  | 'lastDayOff'
  | 'returnGuidance'
  | 'physicianName'
  | 'physicianCredentials'
  | 'physicianNpi'
  | 'licenseState'
  | 'licenseNumber'
>

type VerificationSubmissionState = {
  submission: Pick<Submission, 'status' | 'refundedAt'>
}

export async function createNoteVerificationWithUniqueIdentifiers(
  buildVerification: () => NewNoteVerification,
  maxAttempts: number
): Promise<NoteVerification> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const verification = buildVerification()

    try {
      return await prisma.noteVerification.create({
        data: {
          submissionId: verification.submissionId,
          medicalRecordNumber: verification.medicalRecordNumber,
          verificationSlug: verification.verificationSlug,
          issueDate: verification.issueDate,
          patientInitials: verification.patientInitials,
          firstDayOff: verification.firstDayOff,
          lastDayOff: verification.lastDayOff,
          returnGuidance: verification.returnGuidance,
          physicianName: verification.physicianName,
          physicianCredentials: verification.physicianCredentials,
          physicianNpi: verification.physicianNpi,
          licenseState: verification.licenseState,
          licenseNumber: verification.licenseNumber,
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        attempt < maxAttempts - 1
      ) {
        continue
      }
      throw error
    }
  }

  throw new Error('Failed to create a unique note verification record')
}

export async function findNoteVerificationBySlug(
  verificationSlug: string
): Promise<
  | (Pick<
      NoteVerification,
      | 'medicalRecordNumber'
      | 'status'
      | 'revokedAt'
      | 'issueDate'
      | 'patientInitials'
      | 'firstDayOff'
      | 'lastDayOff'
      | 'returnGuidance'
      | 'physicianName'
      | 'physicianCredentials'
      | 'physicianNpi'
      | 'licenseState'
      | 'licenseNumber'
    > &
      VerificationSubmissionState)
  | null
> {
  return prisma.noteVerification.findUnique({
    where: { verificationSlug },
    select: {
      medicalRecordNumber: true,
      status: true,
      revokedAt: true,
      issueDate: true,
      patientInitials: true,
      firstDayOff: true,
      lastDayOff: true,
      returnGuidance: true,
      physicianName: true,
      physicianCredentials: true,
      physicianNpi: true,
      licenseState: true,
      licenseNumber: true,
      submission: {
        select: {
          status: true,
          refundedAt: true,
        },
      },
    },
  })
}

export async function findNoteVerificationByMedicalRecordNumber(
  medicalRecordNumber: string
): Promise<
  | (Pick<NoteVerification, 'verificationSlug' | 'status' | 'revokedAt'> &
      VerificationSubmissionState)
  | null
> {
  return prisma.noteVerification.findUnique({
    where: { medicalRecordNumber },
    select: {
      verificationSlug: true,
      status: true,
      revokedAt: true,
      submission: {
        select: {
          status: true,
          refundedAt: true,
        },
      },
    },
  })
}

export async function revokeNoteVerificationById(
  verificationId: string,
  revokedAt = new Date()
): Promise<void> {
  await prisma.noteVerification.updateMany({
    where: {
      id: verificationId,
      status: NoteVerificationStatus.ACTIVE,
      revokedAt: null,
    },
    data: {
      status: NoteVerificationStatus.REVOKED,
      revokedAt,
    },
  })
}

export async function revokeOtherNoteVerificationsForSubmission(
  submissionId: string,
  activeVerificationId: string,
  revokedAt = new Date()
): Promise<void> {
  await prisma.noteVerification.updateMany({
    where: {
      submissionId,
      id: { not: activeVerificationId },
      status: NoteVerificationStatus.ACTIVE,
      revokedAt: null,
    },
    data: {
      status: NoteVerificationStatus.REVOKED,
      revokedAt,
    },
  })
}

export async function revokeNoteVerificationForSubmission(
  submissionId: string,
  revokedAt = new Date()
): Promise<void> {
  await prisma.noteVerification.updateMany({
    where: {
      submissionId,
      status: NoteVerificationStatus.ACTIVE,
      revokedAt: null,
    },
    data: {
      status: NoteVerificationStatus.REVOKED,
      revokedAt,
    },
  })
}
