/**
 * Doctor's Note PDF Template
 * Uses @react-pdf/renderer to generate professional medical excuse notes
 *
 * Simplified format - removes all medical details per business requirements
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
} from '@react-pdf/renderer'
import { getStateLicense } from '../state-licenses'
import { join } from 'path'

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
}

// Create styles - Arial font 7pt tiny, matching Doe John note design
const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    fontSize: 10,
    fontFamily: 'Helvetica',
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
    alignItems: 'flex-start',
    position: 'relative',
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  tagline: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  emailLink: {
    fontSize: 9,
    marginBottom: 1,
    color: '#0066cc',
    textDecoration: 'underline',
  },
  headerLine: {
    fontSize: 9,
    color: '#111827',
    marginBottom: 1,
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
    fontSize: 16.5,
    fontFamily: 'Helvetica-Bold',
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
    fontSize: 8,
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  dateIssued: {
    fontSize: 8,
    marginBottom: 8,
  },
  patientSection: {
    marginBottom: 8,
  },
  letterBody: {
    marginBottom: 8,
    lineHeight: 1.3,
  },
  paragraph: {
    fontSize: 8,
    marginBottom: 8,
    textAlign: 'left',
    lineHeight: 1.3,
  },
  concernHeader: {
    fontSize: 8,
    marginBottom: 8,
  },
  dateRange: {
    marginTop: 8,
    marginBottom: 8,
  },
  dateRangeLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  returnText: {
    fontSize: 8,
    marginBottom: 8,
    textAlign: 'left',
    lineHeight: 1.3,
  },
  boldText: {
    fontFamily: 'Helvetica-Bold',
  },
  closing: {
    marginTop: 0,
    marginBottom: 15,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: 8,
    marginRight: -28,
  },
  signatureImage: {
    width: 180,
    height: 60,
    objectFit: 'contain',
  },
  physicianName: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    marginTop: 4,
  },
  npiNumber: {
    fontSize: 8,
    marginTop: 2,
  },
})

/**
 * Format date as Month DD, YYYY (e.g., October 12, 2025)
 * Uses UTC methods to avoid timezone conversion issues
 */
function formatDate(date: Date): string {
  const d = new Date(date)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
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
 * Format note purpose for excuse text
 */
function formatExcuseFrom(purpose: string, other?: string | null): string {
  if (purpose === 'other' && other) {
    return other
  }

  const purposeMap: Record<string, string> = {
    work: 'work',
    school: 'school',
    both: 'work or school',
  }

  return purposeMap[purpose] || 'work or school'
}

/**
 * Doctor's Note PDF Template Component - Simplified
 */
export function DoctorNoteTemplate({
  submissionData,
  doctorInfo,
  issueDate,
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
  const guardianFullName = isMinor && guardianFirstName && guardianLastName
    ? `${guardianFirstName} ${guardianLastName}`
    : null

  // Check if this is a caregiver note
  const isCaregiver = absenceReason === 'Taking care of someone'

  const excuseFrom = formatExcuseFrom(notePurpose, otherNotePurpose)
  const dateIssuedFormatted = formatDate(issueDate)
  const firstDayFormatted = formatDate(firstDayOff)
  const lastDayFormatted = formatDate(lastDayOff)
  const dobFormatted = formatDateOfBirth(patientDateOfBirth)

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
          <Image
            src={watermarkPath}
            style={styles.watermarkImage}
          />
        </View>

        {/* Header Section - Light blue background matching Doe John note */}
        <View style={styles.headerSection}>
          {/* Contact Info (LEFT) */}
          <View style={styles.headerLeft}>
            <Text style={styles.tagline}>Proudly Serving Patients in Over 40 States</Text>
            <Link src="mailto:hello@platinumhealthclinic.com" style={styles.emailLink}>
              <Text>Email: hello@platinumhealthclinic.com</Text>
            </Link>
            <Text style={styles.headerLine}>Phone: 917-300-8543</Text>
            <Text style={styles.headerLine}>Fax: 786-289-9316</Text>
          </View>

          {/* Logo and Clinic Name (RIGHT) */}
          <View style={styles.headerRight}>
            <Image
              src={logoPath}
              style={styles.logo}
            />
            <Text style={styles.clinicName}>Platinum Health</Text>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
            {/* Date Issued */}
            <Text style={styles.dateIssued}>
              <Text style={styles.fieldLabel}>Date Issued: </Text>
              {dateIssuedFormatted}
            </Text>

            {/* Patient/Caregiver Information */}
            <View style={styles.patientSection}>
              <Text style={styles.fieldLine}>
                <Text style={styles.fieldLabel}>{isCaregiver ? 'Caregiver Name: ' : 'Patient Name: '}</Text>
                {patientFullName}
              </Text>
              <Text style={styles.fieldLine}>
                <Text style={styles.fieldLabel}>Date of Birth: </Text>
                {dobFormatted}
              </Text>
              {guardianFullName && (
                <Text style={styles.fieldLine}>
                  <Text style={styles.fieldLabel}>Parent / Guardian: </Text>
                  {guardianFullName}
                </Text>
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
                    This note is to confirm that the above-named caregiver was needed to attend to their family member with a medical condition. Please excuse this individual{notePurpose === 'other' ? '' : ` from ${excuseFrom} / ${excuseFrom}-related activities`} for the following period, if possible.
                  </Text>

                  {/* Start and End Dates */}
                  <View style={styles.dateRange}>
                    <Text style={styles.dateRangeLabel}>Start Date: {firstDayFormatted}</Text>
                    <Text style={styles.dateRangeLabel}>End Date: {lastDayFormatted}</Text>
                  </View>

                  <Text style={styles.returnText}>
                    Furthermore, the above-named caregiver may return {notePurpose === 'other' ? '' : `to ${excuseFrom} `}after {lastDayFormatted}, <Text style={styles.boldText}>with no restrictions.</Text> If you have any questions related to this matter or need further verification, please do not hesitate to contact our office. Our email and phone number are noted above.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.paragraph}>
                    This note is to confirm that the above-named patient was evaluated on {dateIssuedFormatted}. Based on the assessment, please excuse this individual{notePurpose === 'other' ? '' : ` from ${excuseFrom} and related activities`} for the following period due to a medical condition.
                  </Text>

                  {/* Start and End Dates */}
                  <View style={styles.dateRange}>
                    <Text style={styles.dateRangeLabel}>Start Date: {firstDayFormatted}</Text>
                    <Text style={styles.dateRangeLabel}>End Date: {lastDayFormatted}</Text>
                  </View>

                  <Text style={styles.returnText}>
                    Furthermore, the above-named patient may return {notePurpose === 'other' ? '' : `to ${excuseFrom} `}after {lastDayFormatted}, <Text style={styles.boldText}>with no restrictions.</Text> If you have any questions related to this matter or need further verification, please do not hesitate to contact our office. Our email and phone number are noted above.
                  </Text>
                </>
              )}

              <Text style={styles.paragraph}>Thank you,</Text>
            </View>

            {/* Signature Section */}
            <View style={styles.closing}>
              <View style={styles.signatureRow}>
                <Text style={styles.signatureLabel}>Signature:</Text>
                {doctorInfo.signatureUrl && (
                  <Image
                    src={doctorInfo.signatureUrl}
                    style={styles.signatureImage}
                  />
                )}
              </View>

              <Text style={styles.physicianName}>
                Physician Name: Jason Buchwald, MD FACEP
              </Text>
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
