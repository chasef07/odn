import crypto from 'crypto'
import { NoteVerificationStatus, Prisma, Submission } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getStateLicense } from '@/lib/state-licenses'
import { getTodayET } from '@/lib/admin-utils'

export { getVerificationBaseUrl, getVerificationUrl } from '@/lib/verification-url'

const RECORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const RECORD_LENGTH = 8
const SLUG_BYTES = 18
const MAX_CREATE_ATTEMPTS = 5
const DEFAULT_DOCTOR_NPI = '1558307702'

export type NoteVerificationSnapshot = {
  medicalRecordNumber: string
  verificationSlug: string
  issueDate: Date
  patientInitials: string
  firstDayOff: Date
  lastDayOff: Date
  returnGuidance: string
  physicianName: string
  physicianCredentials: string
  physicianNpi: string | null
  licenseState: string | null
  licenseNumber: string | null
}

export function getDefaultIssueDate(): Date {
  return new Date(`${getTodayET()}T00:00:00Z`)
}

export function parseIssueDateInput(evaluationDate?: string): Date {
  if (!evaluationDate) return getDefaultIssueDate()

  const [year, month, day] = evaluationDate.split('-').map(Number)
  if (!year || !month || !day) {
    return getDefaultIssueDate()
  }

  return new Date(Date.UTC(year, month - 1, day))
}

export function getPatientInitials(firstName: string, lastName: string): string {
  const firstInitial = firstName.trim().charAt(0).toUpperCase()
  const lastInitial = lastName.trim().charAt(0).toUpperCase()
  return [firstInitial, lastInitial].filter(Boolean).join('.').concat('.')
}

export function getReturnGuidance(lastDayOff: Date): string {
  return `May return after ${formatDisplayDate(lastDayOff)}`
}

export function formatDisplayDate(date: Date): string {
  const d = new Date(date)
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export function generateMedicalRecordNumber(): string {
  let recordNumber = ''
  for (let i = 0; i < RECORD_LENGTH; i++) {
    recordNumber += RECORD_ALPHABET[crypto.randomInt(0, RECORD_ALPHABET.length)]
  }
  return recordNumber
}

export function generateVerificationSlug(): string {
  return `v_${crypto.randomBytes(SLUG_BYTES).toString('base64url')}`
}

export function normalizeMedicalRecordNumber(input: string): string {
  const compact = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (/^[A-Z0-9]{8}$/.test(compact)) return compact
  const prefixedMatch = compact.match(/^PH\d{4}([A-Z0-9]{8})$/)
  if (prefixedMatch) return prefixedMatch[1]
  return input.trim().toUpperCase()
}

export function getConfiguredPhysician() {
  const name = process.env.DOCTOR_NAME?.trim() || 'Jason Buchwald'
  const credentials = process.env.DOCTOR_CREDENTIALS?.trim() || 'MD FACEP'
  const npi = process.env.DOCTOR_NPI?.trim() || DEFAULT_DOCTOR_NPI

  return { name, credentials, npi }
}

export function buildNoteVerificationSnapshot(
  submission: Submission,
  issueDate: Date,
  medicalRecordNumber: string,
  verificationSlug: string
): NoteVerificationSnapshot {
  const physician = getConfiguredPhysician()
  const stateLicense = getStateLicense(submission.state)

  return {
    medicalRecordNumber,
    verificationSlug,
    issueDate,
    patientInitials: getPatientInitials(submission.patientFirstName, submission.patientLastName),
    firstDayOff: submission.firstDayOff,
    lastDayOff: submission.lastDayOff,
    returnGuidance: getReturnGuidance(submission.lastDayOff),
    physicianName: physician.name,
    physicianCredentials: physician.credentials,
    physicianNpi: physician.npi,
    licenseState: stateLicense?.stateName ?? null,
    licenseNumber: stateLicense?.licenseNumber ?? null,
  }
}

export async function createNoteVerification(submission: Submission, issueDate: Date) {
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const medicalRecordNumber = generateMedicalRecordNumber()
    const verificationSlug = generateVerificationSlug()
    const snapshot = buildNoteVerificationSnapshot(
      submission,
      issueDate,
      medicalRecordNumber,
      verificationSlug
    )

    try {
      return await prisma.noteVerification.create({
        data: {
          submissionId: submission.id,
          medicalRecordNumber: snapshot.medicalRecordNumber,
          verificationSlug: snapshot.verificationSlug,
          issueDate: snapshot.issueDate,
          patientInitials: snapshot.patientInitials,
          firstDayOff: snapshot.firstDayOff,
          lastDayOff: snapshot.lastDayOff,
          returnGuidance: snapshot.returnGuidance,
          physicianName: snapshot.physicianName,
          physicianCredentials: snapshot.physicianCredentials,
          physicianNpi: snapshot.physicianNpi,
          licenseState: snapshot.licenseState,
          licenseNumber: snapshot.licenseNumber,
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        attempt < MAX_CREATE_ATTEMPTS - 1
      ) {
        continue
      }
      throw error
    }
  }

  throw new Error('Failed to create a unique note verification record')
}

export async function revokeNoteVerificationById(verificationId: string, revokedAt = new Date()) {
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
) {
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
) {
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
