import crypto from 'crypto'
import { createNoteVerificationWithUniqueIdentifiers } from '@/db/note-verifications'
import type { NoteVerification, Submission } from '@/db/types'
import { env } from '@/lib/env'
import { getStateLicense } from '@/lib/state-licenses'
import {
  dateOnlyFromUtcDate,
  formatDateOnly,
  parseDateOnly,
  todayET,
  utcDateFromDateOnly,
} from '@/lib/dates'

export { getVerificationBaseUrl, getVerificationUrl } from '@/lib/verification-url'

const RECORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const RECORD_LENGTH = 8
const SLUG_BYTES = 18
const MAX_CREATE_ATTEMPTS = 5

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
  return utcDateFromDateOnly(todayET())
}

export function parseIssueDateInput(evaluationDate?: string): Date {
  const day = evaluationDate ? parseDateOnly(evaluationDate) : null
  return day ? utcDateFromDateOnly(day) : getDefaultIssueDate()
}

export function getPatientInitials(firstName: string, lastName: string): string {
  const firstInitial = firstName.trim().charAt(0).toUpperCase()
  const lastInitial = lastName.trim().charAt(0).toUpperCase()
  return [firstInitial, lastInitial].filter(Boolean).join('.').concat('.')
}

export function getReturnGuidance(lastDayOff: Date): string {
  return `May return after ${formatDateOnly(dateOnlyFromUtcDate(lastDayOff))}`
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
  return { name: env.DOCTOR_NAME, credentials: env.DOCTOR_CREDENTIALS, npi: env.DOCTOR_NPI }
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

export async function createNoteVerification(
  submission: Submission,
  issueDate: Date
): Promise<NoteVerification> {
  return createNoteVerificationWithUniqueIdentifiers(() => {
    const medicalRecordNumber = generateMedicalRecordNumber()
    const verificationSlug = generateVerificationSlug()
    const snapshot = buildNoteVerificationSnapshot(
      submission,
      issueDate,
      medicalRecordNumber,
      verificationSlug
    )

    return { submissionId: submission.id, ...snapshot }
  }, MAX_CREATE_ATTEMPTS)
}
