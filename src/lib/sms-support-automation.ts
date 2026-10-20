import { sendApprovalEmail } from '@/lib/email'
import { SubmissionStatus, type JsonValue, type Submission } from '@/db/types'
import { findSupportJobStatus, findSupportJobWithTicket } from '@/db/sms-support'
import { transition } from '@/db/sms-support-lifecycle'
import {
  commitSupportAutomationSubmissionUpdate,
  findSubmissionById,
  recordApprovalEmailSent,
  type SmsSupportAutomationSubmissionUpdate,
} from '@/db/submissions'
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'
import { generateQrCodeDataUrl } from '@/lib/qr-code'
import { parseDateOnly, utcDateFromDateOnly } from '@/lib/dates'
import {
  createNoteVerification,
  getVerificationUrl,
  parseIssueDateInput,
} from '@/lib/note-verification'
import {
  revokeNoteVerificationById,
  revokeOtherNoteVerificationsForSubmission,
} from '@/db/note-verifications'
import { automationSuccessSms } from '@/lib/sms-support-templates'
import { sendSupportSms } from '@/lib/sms-support-sms'
import {
  SMS_SUPPORT_AUTOMATION_KIND,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_STATUS,
  type SmsSupportAutomationKind,
  type SmsSupportCategory,
} from '@/lib/sms-support-types'

export type SupportAutomationPayload = {
  kind: SmsSupportAutomationKind
  category: SmsSupportCategory
  updates: {
    patientDateOfBirth?: string
    notePurpose?: string
    otherNotePurpose?: string | null
  }
}

type RegenerateInput = {
  jobId: string
  ticketId: string
  submissionId: string
  phoneE164: string
  category: SmsSupportCategory
  updates: SupportAutomationPayload['updates']
}

export class SupportAutomationCancelledError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupportAutomationCancelledError'
  }
}

export class SupportAutomationManualReviewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupportAutomationManualReviewError'
  }
}

export async function runSupportTicketAutomation(jobId: string): Promise<void> {
  const job = await findSupportJobWithTicket(jobId)

  if (!job) throw new Error('Support job not found')

  const claimed = await transition('claimAutomation', job.ticketId, { at: new Date() })
  if (!claimed.ok) {
    throw new SupportAutomationCancelledError('Ticket left automation state before job ran')
  }
  if (!job.ticket.submissionId) throw new Error('Support ticket has no linked submission')

  const payload = parseAutomationPayload(job.payload)
  if (!payload) throw new Error('Support job has an invalid automation payload')

  await assertSupportJobStillRunning(jobId)

  await regenerateApprovedSubmission({
    jobId,
    ticketId: job.ticketId,
    submissionId: job.ticket.submissionId,
    phoneE164: job.ticket.phoneE164,
    category: payload.category,
    updates: payload.updates,
  })

  const closed = await transition('automationSucceeded', job.ticketId, {
    at: new Date(),
    adminSummary: `Automated ${payload.category} update completed and emailed.`,
  })
  if (!closed.ok) {
    console.warn('Support ticket was not closed after automation:', {
      ticketId: job.ticketId,
      refusal: closed.refusal,
    })
  }
}

async function regenerateApprovedSubmission({
  jobId,
  ticketId,
  submissionId,
  phoneE164,
  category,
  updates,
}: RegenerateInput): Promise<void> {
  const submission = await findSubmissionById(submissionId)

  if (!submission) throw new Error('Submission not found')
  if (submission.status !== SubmissionStatus.APPROVED) {
    throw new Error(`Submission is ${submission.status}, not APPROVED`)
  }
  if (typeof submission.approvalWithRestrictions !== 'boolean') {
    throw new SupportAutomationManualReviewError(
      'Approval PDF options are unknown; admin must reissue this note manually'
    )
  }

  const now = new Date()
  const updateData = buildSubmissionUpdateData(updates, now)
  const nextSubmission: Submission = {
    ...submission,
    ...updateDataForPdf(updates),
    status: SubmissionStatus.APPROVED,
    denialReason: null,
    reviewedAt: now,
    updatedAt: now,
  }

  await assertSupportJobStillRunning(jobId)

  const issueDate = parseIssueDateInput()
  const noteVerification = await createNoteVerification(nextSubmission, issueDate)
  const verificationUrl = getVerificationUrl(noteVerification.verificationSlug)

  let pdfBuffer: Buffer
  let pdfFilename: string
  try {
    const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl)
    pdfBuffer = await generateDoctorNotePDF(
      nextSubmission,
      issueDate,
      submission.approvalDiagnosis || undefined,
      submission.approvalWithRestrictions,
      {
        medicalRecordNumber: noteVerification.medicalRecordNumber,
        verificationUrl,
        qrCodeDataUrl,
      }
    )
    pdfFilename = generatePDFFilename(submission.id)
  } catch (error) {
    await revokeNoteVerificationById(noteVerification.id)
    throw new Error(
      `Failed to generate updated PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  try {
    await assertSupportJobStillRunning(jobId)
  } catch (error) {
    await revokeNoteVerificationById(noteVerification.id, now)
    throw error
  }

  const commitResult = await commitSupportAutomationSubmissionUpdate({
    ticketId,
    jobId,
    submissionId,
    submissionUpdatedAt: submission.updatedAt,
    committedAt: now,
    updateData,
  })

  if (commitResult === 'cancelled') {
    await revokeNoteVerificationById(noteVerification.id, now)
    throw new SupportAutomationCancelledError('Support automation was cancelled before note update')
  }

  if (commitResult === 'submission_changed') {
    await revokeNoteVerificationById(noteVerification.id, now)
    throw new Error('Submission changed while support automation was running')
  }

  await revokeOtherNoteVerificationsForSubmission(submissionId, noteVerification.id, now)

  try {
    await sendApprovalEmail({
      to: nextSubmission.email,
      patientName: `${nextSubmission.patientFirstName} ${nextSubmission.patientLastName}`,
      notePurpose: nextSubmission.notePurpose,
      absenceReason: nextSubmission.absenceReason,
      medicalRecordNumber: noteVerification.medicalRecordNumber,
      verificationUrl,
      pdfBuffer,
      pdfFilename,
    })

    await recordApprovalEmailSent(submissionId, new Date())
  } catch (error) {
    throw new Error(
      `Updated note was generated but approval email failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }

  const smsResult = await sendSupportSms({
    ticketId,
    submissionId,
    toPhone: phoneE164,
    type: 'SUPPORT_AUTOMATION_UPDATE',
    body: automationSuccessSms(category),
  })

  if (!smsResult.success) {
    console.warn('Support automation SMS confirmation failed:', {
      ticketId,
      submissionId,
      error: smsResult.error,
    })
  }
}

async function assertSupportJobStillRunning(jobId: string): Promise<void> {
  const job = await findSupportJobStatus(jobId)

  if (job?.status !== SMS_SUPPORT_JOB_STATUS.RUNNING) {
    throw new SupportAutomationCancelledError('Support automation job was cancelled by admin')
  }
}

function buildSubmissionUpdateData(
  updates: SupportAutomationPayload['updates'],
  now: Date
): SmsSupportAutomationSubmissionUpdate {
  const data: SmsSupportAutomationSubmissionUpdate = {
    denialReason: null,
    reviewedAt: now,
    updatedAt: now,
  }

  const pdfUpdates = updateDataForPdf(updates)
  if (pdfUpdates.patientDateOfBirth) data.patientDateOfBirth = pdfUpdates.patientDateOfBirth
  if (pdfUpdates.notePurpose) data.notePurpose = pdfUpdates.notePurpose
  if ('otherNotePurpose' in pdfUpdates) data.otherNotePurpose = pdfUpdates.otherNotePurpose

  return data
}

function updateDataForPdf(updates: SupportAutomationPayload['updates']): Partial<Submission> {
  const data: Partial<Submission> = {}

  if (updates.patientDateOfBirth) {
    const day = parseDateOnly(updates.patientDateOfBirth)
    if (!day) throw new Error('Invalid patient birthday')
    data.patientDateOfBirth = utcDateFromDateOnly(day)
  }

  if (updates.notePurpose) {
    data.notePurpose = updates.notePurpose
    data.otherNotePurpose = updates.otherNotePurpose || null
  }

  return data
}

export function parseAutomationPayload(payload: JsonValue): SupportAutomationPayload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = payload as Record<string, unknown>

  if (!isAutomationKind(value.kind) || !isAutomationCategory(value.category)) return null
  if (!value.updates || typeof value.updates !== 'object' || Array.isArray(value.updates)) {
    return null
  }

  const updates = value.updates as SupportAutomationPayload['updates']
  return {
    kind: value.kind,
    category: value.category,
    updates,
  }
}

export function automationPayloadForCollectedData({
  category,
  patientDateOfBirth,
  notePurpose,
  otherNotePurpose,
}: {
  category: SmsSupportCategory
  patientDateOfBirth?: string
  notePurpose?: string
  otherNotePurpose?: string | null
}): SupportAutomationPayload {
  if (category === SMS_SUPPORT_CATEGORY.CHANGE_DOB && patientDateOfBirth) {
    return {
      kind: SMS_SUPPORT_AUTOMATION_KIND.UPDATE_DOB_REISSUE_NOTE,
      category,
      updates: { patientDateOfBirth },
    }
  }

  if (category === SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE && notePurpose) {
    return {
      kind: SMS_SUPPORT_AUTOMATION_KIND.UPDATE_PURPOSE_REISSUE_NOTE,
      category,
      updates: { notePurpose, otherNotePurpose: otherNotePurpose || null },
    }
  }

  throw new Error('Missing support automation fields')
}

export function automationSummary(payload: SupportAutomationPayload): string {
  if (payload.kind === SMS_SUPPORT_AUTOMATION_KIND.UPDATE_DOB_REISSUE_NOTE) {
    return `Change birthday to ${payload.updates.patientDateOfBirth}`
  }
  if (payload.kind === SMS_SUPPORT_AUTOMATION_KIND.UPDATE_PURPOSE_REISSUE_NOTE) {
    return `Change note purpose to ${payload.updates.notePurpose}`
  }
  return 'Support automation update'
}

function isAutomationKind(value: unknown): value is SmsSupportAutomationKind {
  return Object.values(SMS_SUPPORT_AUTOMATION_KIND).includes(value as SmsSupportAutomationKind)
}

function isAutomationCategory(value: unknown): value is SmsSupportCategory {
  return Object.values(SMS_SUPPORT_CATEGORY).includes(value as SmsSupportCategory)
}
