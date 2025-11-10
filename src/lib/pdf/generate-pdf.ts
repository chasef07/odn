/**
 * PDF Generation Utility
 * Generates doctor's note PDFs from submission data
 */

import { renderToBuffer } from '@react-pdf/renderer'
import { Submission } from '@prisma/client'
import { DoctorNoteTemplate, DoctorNoteData, DoctorInfo } from './doctor-note-template'
import path from 'path'
import fs from 'fs'

/**
 * Validate that all required environment variables are present
 */
function validateDoctorEnvVars(): DoctorInfo {
  const name = process.env.DOCTOR_NAME
  const credentials = process.env.DOCTOR_CREDENTIALS
  const licenseNumber = process.env.DOCTOR_LICENSE_NUMBER
  const signatureUrl = process.env.DOCTOR_SIGNATURE_URL

  if (!name || !credentials || !licenseNumber || !signatureUrl) {
    throw new Error(
      'Missing required doctor environment variables. Please ensure DOCTOR_NAME, DOCTOR_CREDENTIALS, DOCTOR_LICENSE_NUMBER, and DOCTOR_SIGNATURE_URL are set in .env.local'
    )
  }

  return {
    name,
    credentials,
    licenseNumber,
    signatureUrl,
  }
}

/**
 * Convert Prisma Submission to DoctorNoteData format
 */
function submissionToDoctorNoteData(submission: Submission): DoctorNoteData {
  // Parse symptoms JSON
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

/**
 * Get absolute path for signature image
 * Handles both public folder paths and absolute URLs
 */
function resolveSignaturePath(signatureUrl: string): string {
  // If it starts with http:// or https://, return as-is (external URL)
  if (signatureUrl.startsWith('http://') || signatureUrl.startsWith('https://')) {
    return signatureUrl
  }

  // If it starts with /, it's a public folder path
  if (signatureUrl.startsWith('/')) {
    // Remove leading slash for path.join
    const relativePath = signatureUrl.substring(1)
    const absolutePath = path.join(process.cwd(), 'public', relativePath)

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `Signature image not found at ${absolutePath}. Please ensure the signature image exists at public${signatureUrl}`
      )
    }

    return absolutePath
  }

  // Otherwise, treat it as a relative path from project root
  const absolutePath = path.join(process.cwd(), signatureUrl)

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Signature image not found at ${absolutePath}. Please check DOCTOR_SIGNATURE_URL configuration.`
    )
  }

  return absolutePath
}

/**
 * Generate doctor's note PDF from submission data
 *
 * @param submission - Prisma Submission object with all patient/absence data
 * @param issueDate - Date to show as "Date Issued" (defaults to now)
 * @returns Promise<Buffer> - PDF file as Buffer for email attachment
 * @throws Error if required env vars missing or signature image not found
 */
export async function generateDoctorNotePDF(
  submission: Submission,
  issueDate: Date = new Date()
): Promise<Buffer> {
  try {
    // Step 1: Validate environment variables
    const doctorInfo = validateDoctorEnvVars()

    // Step 2: Resolve signature image path
    const resolvedSignaturePath = resolveSignaturePath(doctorInfo.signatureUrl)

    // Update doctor info with resolved path
    const doctorInfoWithResolvedPath: DoctorInfo = {
      ...doctorInfo,
      signatureUrl: resolvedSignaturePath,
    }

    // Step 3: Convert submission to PDF data format
    const submissionData = submissionToDoctorNoteData(submission)

    // Step 4: Generate PDF using template
    const pdfBuffer = await renderToBuffer(
      DoctorNoteTemplate({
        submissionData,
        doctorInfo: doctorInfoWithResolvedPath,
        issueDate,
      })
    )

    if (process.env.NODE_ENV === 'development') {
      console.log(`PDF generated successfully for submission ${submission.id}`)
    }

    return pdfBuffer
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('PDF generation failed:', error)
    }

    // Provide helpful error messages
    if (error instanceof Error) {
      throw new Error(`Failed to generate PDF: ${error.message}`)
    }

    throw new Error('Failed to generate PDF: Unknown error')
  }
}

/**
 * Generate filename for PDF attachment
 *
 * @param submissionId - Submission ID for reference
 * @returns Formatted filename (e.g., "doctors-note-abc123def456.pdf")
 */
export function generatePDFFilename(submissionId: string): string {
  // Use first 12 characters of submission ID for brevity
  const shortId = submissionId.substring(0, 12).toLowerCase()
  return `doctors-note-${shortId}.pdf`
}
