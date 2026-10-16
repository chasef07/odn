'use server'

import { SubmissionStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
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
  revokeNoteVerificationById,
  revokeOtherNoteVerificationsForSubmission,
} from '@/lib/note-verification'
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
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
      })

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
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: SubmissionStatus.APPROVED,
            reviewedByAdminId: doctorId,
            reviewedAt: now,
            denialReason: null,
            approvalEmailSentAt: null,
            approvalDiagnosis: null,
            approvalWithRestrictions: null,
          },
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
      const approvalUpdate = await prisma.submission.updateMany({
        where: {
          id: submissionId,
          status: {
            in: [SubmissionStatus.PENDING_REVIEW, SubmissionStatus.MAYBE],
          },
        },
        data: {
          status: SubmissionStatus.APPROVED,
          reviewedByAdminId: doctorId,
          reviewedAt: now,
          denialReason: null,
          approvalDiagnosis: diagnosis || null,
          approvalWithRestrictions: withRestrictions,
        },
      })
      if (approvalUpdate.count !== 1) {
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

        await prisma.submission.update({
          where: { id: submissionId },
          data: { approvalEmailSentAt: new Date() },
        })

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
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
      })

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
      const approvalUpdate = await prisma.submission.updateMany({
        where: {
          id: submissionId,
          status: SubmissionStatus.APPROVED,
          updatedAt: submission.updatedAt,
        },
        data: {
          status: SubmissionStatus.APPROVED,
          reviewedByAdminId: doctorId,
          reviewedAt: now,
          denialReason: null,
          approvalDiagnosis: diagnosis || null,
          approvalWithRestrictions: withRestrictions,
          updatedAt: now,
        },
      })
      if (approvalUpdate.count !== 1) {
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

        await prisma.submission.update({
          where: { id: submissionId },
          data: { approvalEmailSentAt: new Date() },
        })

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
