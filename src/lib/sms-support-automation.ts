import { Prisma, Submission, SubmissionStatus } from '@prisma/client'
import { sendApprovalEmail } from '@/lib/email'
import prisma from '@/lib/prisma'
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'
import { generateQrCodeDataUrl } from '@/lib/qr-code'
import { parseIsoDateOnlyAsUTCDate } from '@/lib/date-only'
import { formatDateUTC } from '@/lib/utils'
import {
  createNoteVerification,
  getVerificationUrl,
  parseIssueDateInput,
  revokeNoteVerificationById,
  revokeOtherNoteVerificationsForSubmission,
} from '@/lib/note-verification'
import { automationSuccessSms } from '@/lib/sms-support-templates'
import { sendSupportSms } from '@/lib/sms-support-sms'
import {
  SMS_SUPPORT_AUTOMATION_KIND,
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
  type SmsSupportAutomationKind,
  type SmsSupportCategory,
} from '@/lib/sms-support-types'

export type SupportAutomationPayload = {
  kind: SmsSupportAutomationKind
  category: SmsSupportCategory
  updates: {
    patientDateOfBirth?: string
    firstDayOff?: string
    lastDayOff?: string
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

const ACTIVE_AUTOMATION_STATUSES = [
  SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
  SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
] as const

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
  const job = await prisma.smsSupportJob.findUnique({
    where: { id: jobId },
    include: { ticket: true },
  })

  if (!job) throw new Error('Support job not found')
  if (
    job.ticket.status !== SMS_SUPPORT_STATUS.RUNNING_AUTOMATION ||
    !ACTIVE_AUTOMATION_STATUSES.some((status) => status === job.ticket.automationStatus)
  ) {
    throw new SupportAutomationCancelledError('Ticket left automation state before job ran')
  }
  if (!job.ticket.submissionId) throw new Error('Support ticket has no linked submission')

  const payload = parseAutomationPayload(job.payload)
  if (!payload) throw new Error('Support job has an invalid automation payload')

  const claimedTicket = await prisma.smsSupportTicket.updateMany({
    where: {
      id: job.ticketId,
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: {
        in: [...ACTIVE_AUTOMATION_STATUSES],
      },
    },
    data: {
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
      failureReason: null,
    },
  })
  if (claimedTicket.count !== 1) {
    throw new SupportAutomationCancelledError('Ticket left automation state before job ran')
  }

  await assertSupportJobStillRunning(jobId)

  await regenerateApprovedSubmission({
    jobId,
    ticketId: job.ticketId,
    submissionId: job.ticket.submissionId,
    phoneE164: job.ticket.phoneE164,
    category: payload.category,
    updates: payload.updates,
  })

  await prisma.smsSupportTicket.updateMany({
    where: {
      id: job.ticketId,
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
    },
    data: {
      status: SMS_SUPPORT_STATUS.CLOSED,
      state: 'CLOSED',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED,
      adminSummary: `Automated ${payload.category} update completed and emailed.`,
      failureReason: null,
      closedAt: new Date(),
    },
  })
}

async function regenerateApprovedSubmission({
  jobId,
  ticketId,
  submissionId,
  phoneE164,
  category,
  updates,
}: RegenerateInput): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  })

  if (!submission) throw new Error('Submission not found')
  if (submission.status !== SubmissionStatus.APPROVED) {
    throw new Error(`Submission is ${submission.status}, not APPROVED`)
  }
  if (typeof submission.approvalWithRestrictions !== 'boolean') {
    throw new SupportAutomationManualReviewError(
      'Approval PDF options are unknown; staff must reissue this note manually'
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

  const commitResult = await prisma.$transaction(async (tx) => {
    const ticketGuard = await tx.smsSupportTicket.updateMany({
      where: {
        id: ticketId,
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
      },
      data: {
        failureReason: null,
      },
    })

    if (ticketGuard.count !== 1) return 'cancelled' as const

    const jobGuard = await tx.smsSupportJob.updateMany({
      where: {
        id: jobId,
        status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      },
      data: {
        status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
        lockedAt: now,
      },
    })

    if (jobGuard.count !== 1) return 'cancelled' as const

    const submissionUpdate = await tx.submission.updateMany({
      where: {
        id: submissionId,
        status: SubmissionStatus.APPROVED,
        updatedAt: submission.updatedAt,
      },
      data: updateData,
    })

    if (submissionUpdate.count !== 1) return 'submission_changed' as const

    return 'updated' as const
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

    await prisma.submission.update({
      where: { id: submissionId },
      data: { approvalEmailSentAt: new Date() },
    })
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
  const job = await prisma.smsSupportJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  })

  if (job?.status !== SMS_SUPPORT_JOB_STATUS.RUNNING) {
    throw new SupportAutomationCancelledError('Support automation job was cancelled by staff')
  }
}

function buildSubmissionUpdateData(
  updates: SupportAutomationPayload['updates'],
  now: Date
): Prisma.SubmissionUpdateManyMutationInput {
  const data: Prisma.SubmissionUpdateManyMutationInput = {
    denialReason: null,
    reviewedAt: now,
    updatedAt: now,
  }

  const pdfUpdates = updateDataForPdf(updates)
  if (pdfUpdates.patientDateOfBirth) data.patientDateOfBirth = pdfUpdates.patientDateOfBirth
  if (pdfUpdates.firstDayOff) data.firstDayOff = pdfUpdates.firstDayOff
  if (pdfUpdates.lastDayOff) data.lastDayOff = pdfUpdates.lastDayOff
  if (pdfUpdates.notePurpose) data.notePurpose = pdfUpdates.notePurpose
  if ('otherNotePurpose' in pdfUpdates) data.otherNotePurpose = pdfUpdates.otherNotePurpose

  return data
}

function updateDataForPdf(updates: SupportAutomationPayload['updates']): Partial<Submission> {
  const data: Partial<Submission> = {}

  if (updates.patientDateOfBirth) {
    const date = parseIsoDateOnlyAsUTCDate(updates.patientDateOfBirth)
    if (!date) throw new Error('Invalid patient birthday')
    data.patientDateOfBirth = date
  }

  if (updates.firstDayOff) {
    const date = parseIsoDateOnlyAsUTCDate(updates.firstDayOff)
    if (!date) throw new Error('Invalid first day off')
    data.firstDayOff = date
  }

  if (updates.lastDayOff) {
    const date = parseIsoDateOnlyAsUTCDate(updates.lastDayOff)
    if (!date) throw new Error('Invalid last day off')
    data.lastDayOff = date
  }

  if (updates.notePurpose) {
    data.notePurpose = updates.notePurpose
    data.otherNotePurpose = updates.otherNotePurpose || null
  }

  return data
}

export function parseAutomationPayload(payload: Prisma.JsonValue): SupportAutomationPayload | null {
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
  firstDayOff,
  lastDayOff,
  notePurpose,
  otherNotePurpose,
}: {
  category: SmsSupportCategory
  patientDateOfBirth?: string
  firstDayOff?: string
  lastDayOff?: string
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

  if (category === SMS_SUPPORT_CATEGORY.CHANGE_DATES && firstDayOff && lastDayOff) {
    return {
      kind: SMS_SUPPORT_AUTOMATION_KIND.UPDATE_DATES_REISSUE_NOTE,
      category,
      updates: { firstDayOff, lastDayOff },
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
  if (payload.kind === SMS_SUPPORT_AUTOMATION_KIND.UPDATE_DATES_REISSUE_NOTE) {
    return `Change absence dates to ${payload.updates.firstDayOff} - ${payload.updates.lastDayOff}`
  }
  if (payload.kind === SMS_SUPPORT_AUTOMATION_KIND.UPDATE_PURPOSE_REISSUE_NOTE) {
    return `Change note purpose to ${payload.updates.notePurpose}`
  }
  return 'Support automation update'
}

export function currentDobIso(submission: { patientDateOfBirth: Date }): string {
  return formatDateUTC(submission.patientDateOfBirth)
}

function isAutomationKind(value: unknown): value is SmsSupportAutomationKind {
  return Object.values(SMS_SUPPORT_AUTOMATION_KIND).includes(value as SmsSupportAutomationKind)
}

function isAutomationCategory(value: unknown): value is SmsSupportCategory {
  return Object.values(SMS_SUPPORT_CATEGORY).includes(value as SmsSupportCategory)
}
