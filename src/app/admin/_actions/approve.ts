'use server'

import { revalidatePath } from 'next/cache'
import {
  approveManualSubmission,
  approveReviewableSubmission,
  findSubmissionById,
  reapproveSubmission,
  recordApprovalEmailSent,
} from '@/db/submissions'
import { SubmissionStatus } from '@/db/types'
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

export const approveSubmission = adminAction(
  async (
    { doctorId },
    submissionId: string,
    evaluationDate?: string,
    diagnosis?: string,
    withRestrictions: boolean = true
  ) => {
    try {
      const submission = await findSubmissionById(submissionId)

      if (!submission) {
        return { success: false, error: 'Submission not found' }
      }

      if (
        submission.status !== SubmissionStatus.PENDING_REVIEW &&
        submission.status !== SubmissionStatus.MAYBE &&
        submission.status !== SubmissionStatus.MANUAL
      ) {
        return {
          success: false,
          error: `Cannot approve submission with status: ${submission.status}`,
        }
      }

      const isManual = submission.status === SubmissionStatus.MANUAL

      if (isManual) {
        const now = new Date()
        await approveManualSubmission(submissionId, {
          reviewedByAdminId: doctorId,
          reviewedAt: now,
        })

        revalidatePath('/admin')
        revalidatePath('/admin/review')
        revalidatePath('/admin/maybe')

        logger.info(`Manual approval completed for submission ${submissionId}`)

        return { success: true }
      }

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
          diagnosis,
          withRestrictions,
          {
            medicalRecordNumber: noteVerification.medicalRecordNumber,
            verificationUrl,
            qrCodeDataUrl,
          }
        )
        pdfFilename = generatePDFFilename(submission.id)

        logger.info(`PDF generated: ${pdfFilename} for submission ${submissionId}`)
      } catch (pdfError) {
        await revokeNoteVerificationById(noteVerification.id)
        logger.error('PDF generation failed:', pdfError)
        return {
          success: false,
          error: `Failed to generate PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
        }
      }

      const now = new Date()
      const approvedCount = await approveReviewableSubmission(submissionId, {
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        approvalDiagnosis: diagnosis || null,
        approvalWithRestrictions: withRestrictions,
      })
      if (approvedCount !== 1) {
        await revokeNoteVerificationById(noteVerification.id, now)
        return {
          success: false,
          error: 'Submission was already updated. Please refresh and try again.',
        }
      }
      await revokeOtherNoteVerificationsForSubmission(submissionId, noteVerification.id, now)

      const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
      let emailWarning: string | undefined

      try {
        await sendApprovalEmail({
          to: submission.email,
          patientName,
          notePurpose: submission.notePurpose,
          absenceReason: submission.absenceReason,
          medicalRecordNumber: noteVerification.medicalRecordNumber,
          verificationUrl,
          pdfBuffer,
          pdfFilename,
        })

        await recordApprovalEmailSent(submissionId, new Date())

        await sendTransactionalSmsForSubmission({
          submission,
          type: 'APPROVAL_SENT',
          body: approvalSentSms(),
        })

        logger.info(`Approval email sent to ${submission.email} for submission ${submissionId}`)
      } catch (emailError) {
        logger.error('Failed to send approval email:', emailError)
        emailWarning = 'Submission approved, but email notification failed to send'
      }

      revalidatePath('/admin')
      revalidatePath('/admin/review')
      revalidatePath('/admin/maybe')

      if (emailWarning) {
        return { success: true, warning: emailWarning }
      }

      return { success: true }
    } catch (error) {
      logger.error('Error approving submission:', error)
      return {
        success: false,
        error: `Failed to approve submission: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  ) => {
    try {
      const submission = await findSubmissionById(submissionId)

      if (!submission) {
        return { success: false, error: 'Submission not found' }
      }

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
          diagnosis,
          withRestrictions,
          {
            medicalRecordNumber: noteVerification.medicalRecordNumber,
            verificationUrl,
            qrCodeDataUrl,
          }
        )
        pdfFilename = generatePDFFilename(submission.id)

        logger.info(`Re-approval: PDF generated: ${pdfFilename} for submission ${submissionId}`)
      } catch (pdfError) {
        await revokeNoteVerificationById(noteVerification.id)
        logger.error('Re-approval PDF generation failed:', pdfError)
        return {
          success: false,
          error: `Failed to generate PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
        }
      }

      const now = new Date()
      const reapprovedCount = await reapproveSubmission(submissionId, submission.updatedAt, {
        reviewedByAdminId: doctorId,
        reviewedAt: now,
        approvalDiagnosis: diagnosis || null,
        approvalWithRestrictions: withRestrictions,
      })
      if (reapprovedCount !== 1) {
        await revokeNoteVerificationById(noteVerification.id, now)
        return {
          success: false,
          error: 'Submission was already updated. Please refresh and try again.',
        }
      }
      await revokeOtherNoteVerificationsForSubmission(submissionId, noteVerification.id, now)

      const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
      let emailWarning: string | undefined

      try {
        await sendApprovalEmail({
          to: submission.email,
          patientName,
          notePurpose: submission.notePurpose,
          absenceReason: submission.absenceReason,
          medicalRecordNumber: noteVerification.medicalRecordNumber,
          verificationUrl,
          pdfBuffer,
          pdfFilename,
        })

        await recordApprovalEmailSent(submissionId, new Date())

        await sendTransactionalSmsForSubmission({
          submission,
          type: 'APPROVAL_SENT',
          body: approvalSentSms(),
        })

        logger.info(`Re-approval email sent to ${submission.email} for submission ${submissionId}`)
      } catch (emailError) {
        logger.error('Re-approval email failed:', emailError)
        emailWarning = 'Re-approval processed, but email notification failed to send'
      }

      revalidatePath('/admin')
      revalidatePath('/admin/search')
      revalidatePath(`/admin/search/${submissionId}`)
      revalidatePath('/admin/approved')

      if (emailWarning) {
        return { success: true, warning: emailWarning }
      }

      return { success: true }
    } catch (error) {
      logger.error('Error re-approving submission:', error)
      return {
        success: false,
        error: `Failed to re-approve submission: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }
)
