import { renderToBuffer } from '@react-pdf/renderer'
import type { Submission } from '@/db/types'
import {
  DoctorNoteTemplate,
  DoctorNoteData,
  DoctorInfo,
  DoctorNoteVerificationInfo,
} from './doctor-note-template'
import { AfterVisitSummaryTemplate } from './after-visit-summary-template'
import type { AfterVisitSummary } from '@/lib/after-visit-summary'
import { getConfiguredPhysician, getDefaultIssueDate } from '@/lib/note-verification'
import { env } from '@/lib/env'
import path from 'path'
import fs from 'fs'

export const REFERENCE_ID_LENGTH = 12

export function formatReferenceId(submissionId: string, uppercase = false): string {
  const shortId = submissionId.substring(0, REFERENCE_ID_LENGTH)
  return uppercase ? shortId.toUpperCase() : shortId.toLowerCase()
}

function submissionToDoctorNoteData(submission: Submission): DoctorNoteData {
  let symptoms: string[] | null = null
  if (submission.symptoms) {
    try {
      const parsed = submission.symptoms as unknown
      symptoms = Array.isArray(parsed) ? parsed : null
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to parse symptoms JSON:', error)
      }
      symptoms = null
    }
  }

  return {
    patientFirstName: submission.patientFirstName,
    patientLastName: submission.patientLastName,
    patientDateOfBirth: submission.patientDateOfBirth,
    guardianFirstName: submission.guardianFirstName,
    guardianLastName: submission.guardianLastName,
    recipient: submission.recipient,
    firstDayOff: submission.firstDayOff,
    lastDayOff: submission.lastDayOff,
    notePurpose: submission.notePurpose,
    otherNotePurpose: submission.otherNotePurpose,
    absenceReason: submission.absenceReason,
    otherAbsenceReason: submission.otherAbsenceReason,
    symptoms,
    otherSymptomText: submission.otherSymptomText,
    additionalInformation: submission.additionalInformation,
    state: submission.state,
    submissionId: submission.id,
    createdAt: submission.createdAt,
  }
}

function resolveSignaturePath(signatureUrl: string): string {
  if (signatureUrl.startsWith('http://') || signatureUrl.startsWith('https://')) {
    return signatureUrl
  }

  if (signatureUrl.startsWith('/')) {
    const relativePath = signatureUrl.substring(1)
    const absolutePath = path.join(process.cwd(), 'public', relativePath)

    const normalizedPath = path.normalize(absolutePath)
    const publicDir = path.join(process.cwd(), 'public')

    if (!normalizedPath.startsWith(publicDir)) {
      throw new Error(
        'Invalid signature path: Path traversal detected. Signature must be within the public directory.'
      )
    }

    if (!fs.existsSync(normalizedPath)) {
      throw new Error(
        `Signature image not found at ${normalizedPath}. Please ensure the signature image exists at public${signatureUrl}`
      )
    }

    return normalizedPath
  }

  const absolutePath = path.join(process.cwd(), signatureUrl)

  const normalizedPath = path.normalize(absolutePath)
  const projectRoot = process.cwd()

  if (!normalizedPath.startsWith(projectRoot)) {
    throw new Error(
      'Invalid signature path: Path traversal detected. Signature must be within the project directory.'
    )
  }

  if (!fs.existsSync(normalizedPath)) {
    throw new Error(
      `Signature image not found at ${normalizedPath}. Please check DOCTOR_SIGNATURE_URL configuration.`
    )
  }

  return normalizedPath
}

export async function generateDoctorNotePDF(
  submission: Submission,
  issueDate?: Date,
  diagnosis?: string,
  withRestrictions: boolean = true,
  verificationInfo?: DoctorNoteVerificationInfo
): Promise<Buffer> {
  const finalIssueDate = issueDate || getDefaultIssueDate()
  try {
    const doctorInfoWithResolvedPath: DoctorInfo = {
      ...getConfiguredPhysician(),
      signatureUrl: resolveSignaturePath(env.DOCTOR_SIGNATURE_URL),
    }

    const submissionData = submissionToDoctorNoteData(submission)

    const pdfBuffer = await renderToBuffer(
      <DoctorNoteTemplate
        submissionData={submissionData}
        doctorInfo={doctorInfoWithResolvedPath}
        issueDate={finalIssueDate}
        diagnosis={diagnosis}
        withRestrictions={withRestrictions}
        verificationInfo={verificationInfo}
      />
    )

    if (process.env.NODE_ENV === 'development') {
      console.info(`PDF generated successfully for submission ${submission.id}`)
    }

    return pdfBuffer
  } catch (error) {
    console.error('PDF generation failed:', error)

    if (error instanceof Error) {
      throw new Error(`Failed to generate PDF: ${error.message}`)
    }

    throw new Error('Failed to generate PDF: Unknown error')
  }
}

export function generatePDFFilename(submissionId: string): string {
  return `doctors-note-${formatReferenceId(submissionId)}.pdf`
}

export const AFTER_VISIT_SUMMARY_SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.75] as const

export function pdfPageCount(pdf: Buffer): number {
  const counts = [...pdf.toString('latin1').matchAll(/\/Type \/Pages\b[^>]*?\/Count (\d+)/g)]
  if (counts.length !== 1)
    throw new Error(`Expected one page tree in the PDF, found ${counts.length}`)
  return Number(counts[0][1])
}

export async function generateAfterVisitSummaryPDF(summary: AfterVisitSummary): Promise<Buffer> {
  const signatureUrl = resolveSignaturePath(env.DOCTOR_SIGNATURE_URL)
  const onePage = async (scale: number, historyLimit: number): Promise<Buffer | null> => {
    const pdf = await renderToBuffer(
      <AfterVisitSummaryTemplate
        summary={summary}
        signatureUrl={signatureUrl}
        scale={scale}
        historyLimit={historyLimit}
      />
    )
    return pdfPageCount(pdf) === 1 ? pdf : null
  }

  const allHistory = summary.medicalHistory.length
  for (const scale of AFTER_VISIT_SUMMARY_SCALES) {
    const pdf = await onePage(scale, allHistory)
    if (pdf) return pdf
  }

  const smallest = AFTER_VISIT_SUMMARY_SCALES[AFTER_VISIT_SUMMARY_SCALES.length - 1]
  let best = await onePage(smallest, 0)
  if (!best) {
    throw new Error(
      'The after-visit summary does not fit on one page. Shorten or switch off the free-text answers.'
    )
  }
  let fits = 0
  let tooMany = allHistory
  while (tooMany - fits > 1) {
    const middle = Math.floor((fits + tooMany) / 2)
    const pdf = await onePage(smallest, middle)
    if (pdf) {
      best = pdf
      fits = middle
    } else {
      tooMany = middle
    }
  }
  return best
}

export function generateAfterVisitSummaryFilename(submissionId: string): string {
  return `after-visit-summary-${formatReferenceId(submissionId)}.pdf`
}
