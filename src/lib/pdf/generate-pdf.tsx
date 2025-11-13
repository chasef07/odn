/**
 * PDF Generation Utility
 * Generates doctor's note PDFs from submission data
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { Submission } from '@prisma/client'
import { DoctorNoteTemplate, DoctorNoteData, DoctorInfo } from './doctor-note-template'
import path from 'path'
import fs from 'fs'

/**
 * Length of submission ID to use for reference numbers and filenames.
 * Uses first 12 characters of UUID for balance of uniqueness and brevity.
 *
 * UUID format: 550e8400-e29b-41d4-a716-446655440000 (36 characters)
 * First 12 chars: 550e8400-e29 (includes time-based segment + part of clock sequence)
 *
 * Collision probability: ~1 in 16 trillion
 */
export const REFERENCE_ID_LENGTH = 12

/**
 * Format submission ID as short reference code
 * @param submissionId - Full UUID
 * @param uppercase - Whether to return uppercase (default: false)
 * @returns Shortened reference ID
 */
export function formatReferenceId(submissionId: string, uppercase = false): string {
  const shortId = submissionId.substring(0, REFERENCE_ID_LENGTH)
  return uppercase ? shortId.toUpperCase() : shortId.toLowerCase()
}

/**
 * Validate that all required environment variables are present
 */
function validateDoctorEnvVars(): DoctorInfo {
  const name = process.env.DOCTOR_NAME
  const credentials = process.env.DOCTOR_CREDENTIALS
  const signatureUrl = process.env.DOCTOR_SIGNATURE_URL

  if (!name || !credentials || !signatureUrl) {
    throw new Error(
      'Missing required doctor environment variables. Please ensure DOCTOR_NAME, DOCTOR_CREDENTIALS, and DOCTOR_SIGNATURE_URL are set in .env.local'
    )
  }

  return {
    name,
    credentials,
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

    // Security: Prevent path traversal attacks
    const normalizedPath = path.normalize(absolutePath)
    const publicDir = path.join(process.cwd(), 'public')

    if (!normalizedPath.startsWith(publicDir)) {
      throw new Error(
        'Invalid signature path: Path traversal detected. Signature must be within the public directory.'
      )
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(
        `Signature image not found at ${normalizedPath}. Please ensure the signature image exists at public${signatureUrl}`
      )
    }

    return normalizedPath
  }

  // Otherwise, treat it as a relative path from project root
  const absolutePath = path.join(process.cwd(), signatureUrl)

  // Security: Prevent path traversal attacks
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

/**
 * Generate doctor's note PDF from submission data
 *
 * @param submission - Prisma Submission object with all patient/absence data
 * @param issueDate - Date to show as "Date Issued" (defaults to today in UTC)
 * @returns Promise<Buffer> - PDF file as Buffer for email attachment
 * @throws Error if required env vars missing or signature image not found
 */
export async function generateDoctorNotePDF(
  submission: Submission,
  issueDate?: Date
): Promise<Buffer> {
  // Default to today's date in UTC (calendar date, not timestamp)
  const now = new Date()
  const defaultIssueDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ))
  const finalIssueDate = issueDate || defaultIssueDate
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
      <DoctorNoteTemplate
        submissionData={submissionData}
        doctorInfo={doctorInfoWithResolvedPath}
        issueDate={finalIssueDate}
      />
    )

    if (process.env.NODE_ENV === 'development') {
      console.log(`PDF generated successfully for submission ${submission.id}`)
    }

    return pdfBuffer
  } catch (error) {
    console.error('PDF generation failed:', error)

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
  return `doctors-note-${formatReferenceId(submissionId)}.pdf`
}
