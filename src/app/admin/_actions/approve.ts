'use server'

import { permit, transition, type Approval, type Permit } from '@/db/submission-lifecycle'
import { recordApprovalEmailSent } from '@/db/submissions'
import { logger } from '@/lib/logger'
import { sendApprovalEmail } from '@/lib/email'
import { approvalSentSms } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'
import { generateQrCodeDataUrl } from '@/lib/qr-code'
import {
  createNoteVerification,
  getVerificationUrl,
  parseIssueDateInput,
} from '@/lib/note-verification'
import {
  revokeNoteVerificationById,
  revokeOtherNoteVerificationsForSubmission,
} from '@/db/note-verifications'
import { adminAction } from '@/lib/admin-session'
import { errorMessage, refused, revalidate, type ActionResult, type Verb } from './shared'

const QUEUE_PATHS = ['/admin', '/admin/review', '/admin/maybe']

export const approveSubmission = adminAction(
  async (
    { doctorId },
    submissionId: string,
    evaluationDate?: string,
    diagnosis?: string,
    withRestrictions: boolean = true
  ): Promise<ActionResult> => {
    try {
      const allowed = await permit(submissionId, 'approveManual', 'approve')
      if (!allowed.ok) return refused('approve', allowed.refusal)
      const review = { adminId: doctorId, at: new Date() }

      if (allowed.value.transition === 'approveManual') {
        const approved = await transition(allowed.value, review)
        if (!approved.ok) return refused('approve', approved.refusal)

        revalidate(QUEUE_PATHS)

        logger.info(`Manual approval completed for submission ${submissionId}`)

        return { success: true }
      }

      const result = await issueApproval(
        allowed.value,
        'approve',
        { ...review, diagnosis: diagnosis || null, withRestrictions },
        evaluationDate,
        'Submission approved, but email notification failed to send'
      )
      if (result.success) revalidate(QUEUE_PATHS)
      return result
    } catch (error) {
      logger.error('Error approving submission:', error)
      return {
        success: false,
        error: `Failed to approve submission: ${errorMessage(error)}`,
      }
    }
  }
)

export const reApproveSubmission = adminAction(
  async (
    { doctorId },
    submissionId: string,
    evaluationDate?: string,
    diagnosis?: string,
    withRestrictions: boolean = true
  ): Promise<ActionResult> => {
    try {
      const allowed = await permit(submissionId, 'reapprove')
      if (!allowed.ok) return refused('re-approve', allowed.refusal)

      const result = await issueApproval(
        allowed.value,
        're-approve',
        { adminId: doctorId, at: new Date(), diagnosis: diagnosis || null, withRestrictions },
        evaluationDate,
        'Re-approval processed, but email notification failed to send'
      )
      if (result.success) {
        revalidate(['/admin', '/admin/search', `/admin/search/${submissionId}`, '/admin/approved'])
      }
      return result
    } catch (error) {
      logger.error('Error re-approving submission:', error)
      return {
        success: false,
        error: `Failed to re-approve submission: ${errorMessage(error)}`,
      }
    }
  }
)

async function issueApproval(
  allowed: Permit<'approve' | 'reapprove'>,
  verb: Verb,
  approval: Approval,
  evaluationDate: string | undefined,
  emailFailure: string
): Promise<ActionResult> {
  const submission = allowed.row
  const issueDate = parseIssueDateInput(evaluationDate)
  const noteVerification = await createNoteVerification(submission, issueDate)
  const verificationUrl = getVerificationUrl(noteVerification.verificationSlug)

  let pdfBuffer: Buffer
  let pdfFilename: string
  try {
    const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl)
    pdfBuffer = await generateDoctorNotePDF(
      submission,
      issueDate,
      approval.diagnosis ?? undefined,
      approval.withRestrictions,
      {
        medicalRecordNumber: noteVerification.medicalRecordNumber,
        verificationUrl,
        qrCodeDataUrl,
      }
    )
    pdfFilename = generatePDFFilename(submission.id)

    logger.info(`PDF generated: ${pdfFilename} for submission ${submission.id}`)
  } catch (pdfError) {
    await revokeNoteVerificationById(noteVerification.id)
    logger.error('PDF generation failed:', pdfError)
    return {
      success: false,
      error: `Failed to generate PDF: ${errorMessage(pdfError)}`,
    }
  }

  const approved = await transition(allowed, approval)
  if (!approved.ok) {
    await revokeNoteVerificationById(noteVerification.id, approval.at)
    return refused(verb, approved.refusal)
  }
  await revokeOtherNoteVerificationsForSubmission(submission.id, noteVerification.id, approval.at)

  try {
    await sendApprovalEmail({
      to: submission.email,
      patientName: `${submission.patientFirstName} ${submission.patientLastName}`,
      notePurpose: submission.notePurpose,
      absenceReason: submission.absenceReason,
      medicalRecordNumber: noteVerification.medicalRecordNumber,
      verificationUrl,
      pdfBuffer,
      pdfFilename,
    })

    await recordApprovalEmailSent(submission.id, new Date())

    await sendTransactionalSmsForSubmission({
      submission: approved.value,
      type: 'APPROVAL_SENT',
      body: approvalSentSms(),
    })

    logger.info(`Approval email sent to ${submission.email} for submission ${submission.id}`)
    return { success: true }
  } catch (emailError) {
    logger.error('Failed to send approval email:', emailError)
    return { success: true, warning: emailFailure }
  }
}
