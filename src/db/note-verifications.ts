import { db } from './pool'
import { sql } from './sql'
import { insert, select, selectAll, set } from './table'
import { noteVerifications, submissions } from './tables'
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

type SubmissionStateColumns = {
  submissionStatus: Submission['status']
  submissionRefundedAt: Submission['refundedAt']
}

const submissionState = select(submissions, ['status', 'refundedAt'], {
  alias: 's',
  prefix: 'submission',
})

function nestSubmissionState<T extends SubmissionStateColumns>(
  row: T
): Omit<T, keyof SubmissionStateColumns> & VerificationSubmissionState {
  const { submissionStatus, submissionRefundedAt, ...verification } = row
  return {
    ...verification,
    submission: { status: submissionStatus, refundedAt: submissionRefundedAt },
  }
}

export async function createNoteVerificationWithUniqueIdentifiers(
  buildVerification: () => NewNoteVerification,
  maxAttempts: number
): Promise<NoteVerification> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const created = await db.one(
      sql`${insert(noteVerifications, buildVerification())} ON CONFLICT DO NOTHING RETURNING ${selectAll(noteVerifications)}`
    )
    if (created) return created
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
  const row = await db.one(
    sql`SELECT ${select(
      noteVerifications,
      [
        'medicalRecordNumber',
        'status',
        'revokedAt',
        'issueDate',
        'patientInitials',
        'firstDayOff',
        'lastDayOff',
        'returnGuidance',
        'physicianName',
        'physicianCredentials',
        'physicianNpi',
        'licenseState',
        'licenseNumber',
      ],
      { alias: 'v' }
    )}, ${submissionState}
    FROM note_verifications v
    JOIN submissions s ON s.id = v.submission_id
    WHERE v.verification_slug = ${verificationSlug}`
  )
  return row && nestSubmissionState(row)
}

export async function findNoteVerificationByMedicalRecordNumber(
  medicalRecordNumber: string
): Promise<
  | (Pick<NoteVerification, 'verificationSlug' | 'status' | 'revokedAt'> &
      VerificationSubmissionState)
  | null
> {
  const row = await db.one(
    sql`SELECT ${select(noteVerifications, ['verificationSlug', 'status', 'revokedAt'], { alias: 'v' })}, ${submissionState}
    FROM note_verifications v
    JOIN submissions s ON s.id = v.submission_id
    WHERE v.medical_record_number = ${medicalRecordNumber}`
  )
  return row && nestSubmissionState(row)
}

function revoke(revokedAt: Date) {
  return set(noteVerifications, { status: NoteVerificationStatus.REVOKED, revokedAt })
}

export async function revokeNoteVerificationById(
  verificationId: string,
  revokedAt = new Date()
): Promise<void> {
  await db.affected(
    sql`UPDATE note_verifications SET ${revoke(revokedAt)}
    WHERE id = ${verificationId}
      AND status = ${NoteVerificationStatus.ACTIVE}
      AND revoked_at IS NULL`
  )
}

export async function revokeOtherNoteVerificationsForSubmission(
  submissionId: string,
  activeVerificationId: string,
  revokedAt = new Date()
): Promise<void> {
  await db.affected(
    sql`UPDATE note_verifications SET ${revoke(revokedAt)}
    WHERE submission_id = ${submissionId}
      AND id <> ${activeVerificationId}
      AND status = ${NoteVerificationStatus.ACTIVE}
      AND revoked_at IS NULL`
  )
}

export async function revokeNoteVerificationForSubmission(
  submissionId: string,
  revokedAt = new Date()
): Promise<void> {
  await db.affected(
    sql`UPDATE note_verifications SET ${revoke(revokedAt)}
    WHERE submission_id = ${submissionId}
      AND status = ${NoteVerificationStatus.ACTIVE}
      AND revoked_at IS NULL`
  )
}
