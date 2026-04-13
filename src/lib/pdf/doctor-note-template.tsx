/**
 * Doctor's Note PDF Template
 * Uses @react-pdf/renderer to generate professional medical excuse notes
 *
 * Simplified format - removes all medical details per business requirements
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Link, Font } from '@react-pdf/renderer'
import { getStateLicense } from '../state-licenses'
import { getPdfActivitiesText } from '../email-helpers'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * Validate that font files exist before registration
 * Throws descriptive error if fonts are missing
 */
function validateFontFiles(): void {
  const fontPaths = [
    join(
      process.cwd(),
      'node_modules',
      '@fontsource',
      'plus-jakarta-sans',
      'files',
      'plus-jakarta-sans-latin-400-normal.woff'
    ),
    join(
      process.cwd(),
      'node_modules',
      '@fontsource',
      'plus-jakarta-sans',
      'files',
      'plus-jakarta-sans-latin-700-normal.woff'
    ),
  ]

  for (const fontPath of fontPaths) {
    if (!existsSync(fontPath)) {
      throw new Error(
        `Font file not found: ${fontPath}\n` +
          'Please run "npm install" to install font dependencies (@fontsource/plus-jakarta-sans).'
      )
    }
  }
}

/**
 * Register Plus Jakarta Sans font with error handling
 *
 * Font Source: @fontsource/plus-jakarta-sans npm package
 * - Loads from node_modules (installed via package.json)
 * - Uses WOFF format for optimal PDF compatibility
 * - Includes normal (400) and bold (700) weights
 * - Validates files exist before registration
 *
 * Fallback: If fonts fail to load, @react-pdf/renderer uses system fonts
 */
try {
  validateFontFiles()

  Font.register({
    family: 'Plus Jakarta Sans',
    fonts: [
      {
        src: join(
          process.cwd(),
          'node_modules',
          '@fontsource',
          'plus-jakarta-sans',
          'files',
          'plus-jakarta-sans-latin-400-normal.woff'
        ),
        fontWeight: 'normal',
      },
      {
        src: join(
          process.cwd(),
          'node_modules',
          '@fontsource',
          'plus-jakarta-sans',
          'files',
          'plus-jakarta-sans-latin-700-normal.woff'
        ),
        fontWeight: 'bold',
      },
    ],
  })

  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Plus Jakarta Sans fonts loaded successfully for PDF generation')
  }
} catch (error) {
  console.error('⚠️ Font loading failed, PDF will use fallback system fonts:', error)
  // Continue execution - @react-pdf/renderer will use default fonts
}

// Define comprehensive type for submission data
export interface DoctorNoteData {
  // Patient Information
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: Date

  // Guardian Information (optional)
  guardianFirstName?: string | null
  guardianLastName?: string | null
  recipient: string

  // Absence Information
  firstDayOff: Date
  lastDayOff: Date
  notePurpose: string
  otherNotePurpose?: string | null

  // Medical Information
  absenceReason: string
  otherAbsenceReason?: string | null
  symptoms?: string[] | null // JSON array from Prisma
  otherSymptomText?: string | null
  additionalInformation?: string | null

  // Metadata
  state: string
  submissionId: string
  createdAt: Date
}

export interface DoctorInfo {
  name: string
  credentials: string
  signatureUrl: string
}

interface DoctorNoteTemplateProps {
  submissionData: DoctorNoteData
  doctorInfo: DoctorInfo
  issueDate: Date
  diagnosis?: string
  withRestrictions?: boolean
}

// Create styles - Plus Jakarta Sans font
const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    fontSize: 7,
    fontFamily: 'Plus Jakarta Sans',
    backgroundColor: '#ffffff',
    lineHeight: 1.3,
    position: 'relative',
  },
  // Image in bottom right - NOT a watermark
  watermarkContainer: {
    position: 'absolute',
    bottom: -40,
    right: -40,
    opacity: 1,
    zIndex: 1,
  },
  watermarkImage: {
    width: 350,
    height: 350,
    objectFit: 'contain',
  },
  // Header with light blue diagonal background
  headerSection: {
    backgroundColor: '#d9edf7',
    paddingLeft: 72,
    paddingRight: 72,
    paddingTop: 30,
    paddingBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    position: 'relative',
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  tagline: {
    fontSize: 7,
    fontFamily: 'Plus Jakarta Sans',
    color: '#111827',
    marginBottom: 2,
  },
  emailLink: {
    fontSize: 7,
    marginBottom: 1,
    color: '#0066cc',
    textDecoration: 'underline',
  },
  headerLine: {
    fontSize: 7,
    fontFamily: 'Plus Jakarta Sans',
    color: '#111827',
    marginBottom: 2,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    marginBottom: 4,
  },
  clinicName: {
    fontSize: 14,
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 0.5,
  },
  contentSection: {
    paddingLeft: 72,
    paddingRight: 72,
    paddingTop: 40,
    paddingBottom: 40,
    position: 'relative',
    zIndex: 1,
  },
  // Field styling with bold labels
  fieldLine: {
    fontSize: 7,
    marginBottom: 2,
  },
  fieldLabel: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 'bold',
  },
  headerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateIssued: {
    fontSize: 7,
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 'bold',
    lineHeight: 1,
  },
  medicalRecordNumber: {
    fontSize: 7,
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 'bold',
    lineHeight: 1,
    marginTop: -4.315,
  },
  patientSection: {
    marginBottom: 0,
  },
  patientField: {
    fontSize: 7,
    marginBottom: 10,
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 'bold',
  },
  letterBody: {
    marginBottom: 0,
    lineHeight: 1.0,
  },
  paragraph: {
    fontSize: 7,
    marginBottom: 10,
    textAlign: 'left',
    lineHeight: 1.5,
  },
  thankYou: {
    fontSize: 7,
    marginBottom: 10,
    textAlign: 'left',
    lineHeight: 1.5,
  },
  concernHeader: {
    fontSize: 7,
    marginBottom: 10,
    lineHeight: 1.5,
  },
  dateRange: {
    marginTop: 0,
    marginBottom: 0,
  },
  dateRangeLabel: {
    fontSize: 7,
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 'bold',
    marginBottom: 10,
    lineHeight: 1.0,
  },
  returnText: {
    fontSize: 7,
    marginBottom: 10,
    textAlign: 'left',
    lineHeight: 1.5,
  },
  boldText: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 'bold',
  },
  boldUnderlineText: {
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
  closing: {
    marginTop: 0,
    marginBottom: 15,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  signatureLabel: {
    fontSize: 7,
    marginRight: 50,
  },
  signatureImage: {
    width: 140,
    height: 50,
    objectFit: 'contain',
    position: 'absolute',
    left: 15,
    top: -15,
  },
  physicianName: {
    fontSize: 7,
    marginBottom: 10,
    marginTop: 0,
  },
  npiNumber: {
    fontSize: 7,
    marginTop: 0,
  },
})

/**
 * Format date as Month DD, YYYY (e.g., October 12, 2025)
 * Uses UTC methods to avoid timezone conversion issues
 */
function formatDate(date: Date): string {
  const d = new Date(date)
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const month = monthNames[d.getUTCMonth()]
  const day = d.getUTCDate()
  const year = d.getUTCFullYear()
  return `${month} ${day}, ${year}`
}

/**
 * Format date of birth as MM/DD/YYYY
 * Uses UTC methods to avoid timezone conversion issues
 */
function formatDateOfBirth(date: Date): string {
  const d = new Date(date)
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${month}/${day}/${year}`
}

/**
 * Format note purpose for excuse text (used in "may return to X" text)
 */
function formatExcuseFrom(purpose: string, other?: string | null): string {
  if (purpose === 'other' && other) {
    return other
  }

  const purposeMap: Record<string, string> = {
    work: 'work',
    school: 'school',
    both: 'work and school',
    travel: 'travel',
  }

  return purposeMap[purpose] || 'work and school'
}

/**
 * Doctor's Note PDF Template Component - Simplified
 */
export function DoctorNoteTemplate({
  submissionData,
  doctorInfo,
  issueDate,
  diagnosis,
  withRestrictions = true,
}: DoctorNoteTemplateProps): React.ReactElement {
  const {
    patientFirstName,
    patientLastName,
    patientDateOfBirth,
    guardianFirstName,
    guardianLastName,
    recipient,
    firstDayOff,
    lastDayOff,
    notePurpose,
    otherNotePurpose,
    absenceReason,
  } = submissionData

  const patientFullName = `${patientFirstName} ${patientLastName}`
  const isMinor = recipient === 'someone_else'
  const guardianFullName =
    isMinor && guardianFirstName && guardianLastName
      ? `${guardianFirstName} ${guardianLastName}`
      : null

  // Check if this is a caregiver note or doctor's appointment
  const isCaregiver = absenceReason === 'Taking care of someone'
  const isAppointment = absenceReason === "Doctor's appointment"

  const excuseFrom = formatExcuseFrom(notePurpose, otherNotePurpose)
  const dateIssuedFormatted = formatDate(issueDate)
  const firstDayFormatted = formatDate(firstDayOff)
  const lastDayFormatted = formatDate(lastDayOff)
  const dobFormatted = formatDateOfBirth(patientDateOfBirth)

  // Format medical record number from submission ID (first 8 chars, uppercase)
  const medicalRecordNumber = submissionData.submissionId.toUpperCase().substring(0, 8)

  // Get state-specific medical license
  const stateLicense = getStateLicense(submissionData.state)

  // Logo path - use absolute path from project root for reliability in all environments
  const logoPath = join(process.cwd(), 'public', 'images', 'logo.png')
  const watermarkPath = join(process.cwd(), 'public', 'images', 'no-bg.png')

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Watermark in bottom right */}
        <View style={styles.watermarkContainer}>
          <Image src={watermarkPath} style={styles.watermarkImage} />
        </View>

        {/* Header Section - Light blue background matching Doe John note */}
        <View style={styles.headerSection}>
          {/* Contact Info (LEFT) */}
          <View style={styles.headerLeft}>
            <Text style={styles.tagline}>Proudly Serving Patients in Over 40 States</Text>
            <Text style={styles.headerLine}>
              Email:{' '}
              <Link src="mailto:hello@platinumhealthclinic.com" style={styles.emailLink}>
                hello@platinumhealthclinic.com
              </Link>
            </Text>
            <Text style={styles.headerLine}>Phone: 786-292-3730</Text>
            <Text style={styles.headerLine}>Fax: 786-289-9316</Text>
          </View>

          {/* Logo and Clinic Name (RIGHT) */}
          <View style={styles.headerRight}>
            <Image src={logoPath} style={styles.logo} />
            <Text style={styles.clinicName}>Platinum Health</Text>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Date Issued and Medical Record Number */}
          <View style={styles.headerInfoRow}>
            <Text style={styles.dateIssued}>Date Issued: {dateIssuedFormatted}</Text>
            <Text style={styles.medicalRecordNumber}>Medical Record #: {medicalRecordNumber}</Text>
          </View>

          {/* Patient/Caregiver Information */}
          <View style={styles.patientSection}>
            <Text style={styles.patientField}>
              {isCaregiver ? 'Caregiver Name: ' : 'Patient Name: '}
              {patientFullName}
            </Text>
            <Text style={styles.patientField}>Date of Birth: {dobFormatted}</Text>
            {guardianFullName && (
              <Text style={styles.patientField}>Parent / Guardian: {guardianFullName}</Text>
            )}
          </View>

          {/* Letter Body */}
          <View style={styles.letterBody}>
            <Text style={styles.concernHeader}>
              <Text style={styles.fieldLabel}>To Whom It May Concern:</Text>
            </Text>

            {isCaregiver ? (
              <>
                <Text style={styles.paragraph}>
                  This note is to confirm that the above-named caregiver was needed to attend to
                  their family member with a medical condition.
                  {diagnosis?.trim() ? ` ${diagnosis.trim()}` : ''} Please excuse this individual
                  {notePurpose === 'other' ? '' : ` ${getPdfActivitiesText(notePurpose)}`} for the
                  following period, if possible.
                </Text>

                {/* Start and End Dates */}
                <View style={styles.dateRange}>
                  <Text style={styles.dateRangeLabel}>First Day Off: {firstDayFormatted}</Text>
                  <Text style={styles.dateRangeLabel}>Last Day Off: {lastDayFormatted}</Text>
                </View>

                <Text style={styles.returnText}>
                  Furthermore, the above-named caregiver{' '}
                  <Text style={styles.boldText}>
                    may return {notePurpose === 'other' ? '' : `to ${excuseFrom} `}
                    <Text style={styles.boldUnderlineText}>after</Text> {lastDayFormatted}
                    {withRestrictions ? ', with no restrictions' : ''}.
                  </Text>{' '}
                  If you have any questions related to this matter or need further verification,
                  please do not hesitate to contact our office. Our email and phone number are noted
                  above.
                </Text>
              </>
            ) : isAppointment ? (
              <>
                <Text style={styles.paragraph}>
                  This note is to confirm that the above-named patient was evaluated on{' '}
                  {dateIssuedFormatted}. Based on the assessment, please excuse this individual
                  {notePurpose === 'other' ? '' : ` ${getPdfActivitiesText(notePurpose)}`} for the
                  following period for a doctor&apos;s appointment.
                  {diagnosis?.trim() ? ` ${diagnosis.trim()}` : ''}
                </Text>

                {/* Start and End Dates */}
                <View style={styles.dateRange}>
                  <Text style={styles.dateRangeLabel}>First Day Off: {firstDayFormatted}</Text>
                  <Text style={styles.dateRangeLabel}>Last Day Off: {lastDayFormatted}</Text>
                </View>

                <Text style={styles.returnText}>
                  Furthermore, the above-named patient{' '}
                  <Text style={styles.boldText}>
                    may return {notePurpose === 'other' ? '' : `to ${excuseFrom} `}
                    <Text style={styles.boldUnderlineText}>after</Text> {lastDayFormatted}
                    {withRestrictions ? ', with no restrictions' : ''}.
                  </Text>{' '}
                  If you have any questions related to this matter or need further verification,
                  please do not hesitate to contact our office. Our email and phone number are noted
                  above.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.paragraph}>
                  This note is to confirm that the above-named patient was evaluated on{' '}
                  {dateIssuedFormatted}. Based on the assessment, please excuse this individual
                  {notePurpose === 'other' ? '' : ` ${getPdfActivitiesText(notePurpose)}`} for the
                  following period due to a medical condition.
                  {diagnosis?.trim() ? ` ${diagnosis.trim()}` : ''}
                </Text>

                {/* Start and End Dates */}
                <View style={styles.dateRange}>
                  <Text style={styles.dateRangeLabel}>First Day Off: {firstDayFormatted}</Text>
                  <Text style={styles.dateRangeLabel}>Last Day Off: {lastDayFormatted}</Text>
                </View>

                <Text style={styles.returnText}>
                  Furthermore, the above-named patient{' '}
                  <Text style={styles.boldText}>
                    may return {notePurpose === 'other' ? '' : `to ${excuseFrom} `}
                    <Text style={styles.boldUnderlineText}>after</Text> {lastDayFormatted}
                    {withRestrictions ? ', with no restrictions' : ''}.
                  </Text>{' '}
                  If you have any questions related to this matter or need further verification,
                  please do not hesitate to contact our office. Our email and phone number are noted
                  above.
                </Text>
              </>
            )}

            <Text style={styles.thankYou}>Thank you,</Text>
          </View>

          {/* Signature Section */}
          <View style={styles.closing}>
            <View style={styles.signatureRow}>
              <Text style={styles.signatureLabel}>Signature:</Text>
              {doctorInfo.signatureUrl && (
                <Image src={doctorInfo.signatureUrl} style={styles.signatureImage} />
              )}
            </View>

            <Text style={styles.physicianName}>Physician Name: Jason Buchwald, MD FACEP</Text>
            {stateLicense && (
              <Text style={styles.npiNumber}>
                {stateLicense.stateName} Medical License #{stateLicense.licenseNumber}
              </Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}

export default DoctorNoteTemplate
