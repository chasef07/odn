'use server'

import { findPatientHistory, findSubmissionById } from '@/db/submissions'
import { buildAfterVisitSummary } from '@/lib/after-visit-summary'
import { adminAction } from '@/lib/admin-session'
import { dateOnlyFromUtcDate } from '@/lib/dates'
import { sendAfterVisitSummaryEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { wouldExceedMonthlyLimit } from '@/lib/monthly-limit'
import { getConfiguredPhysician } from '@/lib/note-verification'
import {
  generateAfterVisitSummaryFilename,
  generateAfterVisitSummaryPDF,
} from '@/lib/pdf/generate-pdf'

export const sendAfterVisitSummary = adminAction(
  async (
    _admin,
    submissionId: string,
    { includeAdditionalInformation }: { includeAdditionalInformation: boolean }
  ): Promise<{ success: true } | { success: false; error: string }> => {
    const submission = await findSubmissionById(submissionId)
    if (!submission) return { success: false, error: 'Submission not found' }

    try {
      const [history, rollingLimit] = await Promise.all([
        findPatientHistory({
          patientFirstName: submission.patientFirstName,
          patientLastName: submission.patientLastName,
          patientDateOfBirth: submission.patientDateOfBirth,
          email: submission.email,
          excludeSubmissionId: submission.id,
        }),
        wouldExceedMonthlyLimit(
          submission.patientFirstName,
          submission.patientLastName,
          dateOnlyFromUtcDate(submission.patientDateOfBirth),
          dateOnlyFromUtcDate(submission.firstDayOff),
          dateOnlyFromUtcDate(submission.lastDayOff)
        ),
      ])

      const summary = buildAfterVisitSummary({
        submission,
        history,
        rollingLimit: {
          usedDays: rollingLimit.currentUsage.totalDays,
          requestedDays: rollingLimit.requestedDays,
          totalDays: rollingLimit.newTotal,
          exceeded: rollingLimit.wouldExceed,
        },
        physician: getConfiguredPhysician(),
        includeAdditionalInformation,
      })

      await sendAfterVisitSummaryEmail({
        patientName: `${submission.patientFirstName} ${submission.patientLastName}`,
        pdfBuffer: await generateAfterVisitSummaryPDF(summary),
        pdfFilename: generateAfterVisitSummaryFilename(submission.id),
      })

      return { success: true }
    } catch (error) {
      logger.error('Error sending after-visit summary:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send after-visit summary',
      }
    }
  }
)
