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

// Create styles - Times New Roman 12pt, elevated design with modern header and watermark
const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    fontSize: 12,
    fontFamily: 'Times-Roman',
    backgroundColor: '#ffffff',
    lineHeight: 1.5,
  },
  // Header with light blue background
  headerSection: {
    backgroundColor: '#E0F2FE',
    height: 120,
    paddingLeft: 72,
    paddingRight: 72,
    paddingTop: 25,
    paddingBottom: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  headerLine: {
    fontSize: 10,
    marginBottom: 3,
    color: '#1F2937',
  },
  emailLink: {
    fontSize: 10,
    marginBottom: 3,
    color: '#1F2937',
    textDecoration: 'none',
  },
  clinicName: {
    fontSize: 16,
    fontFamily: 'Times-Bold',
    color: '#111827',
    letterSpacing: 0.5,
    marginTop: 10,
  },
  servingStates: {
    fontSize: 10,
    color: '#1F2937',
    marginBottom: 3,
  },
  contentSection: {
    paddingLeft: 72,
    paddingRight: 72,
    paddingTop: 30,
    paddingBottom: 40,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    marginBottom: 30,
    textTransform: 'uppercase',
  },
  // Field styling with bold labels
  fieldLine: {
    fontSize: 12,
    marginBottom: 8,
  },
  fieldLabel: {
    fontFamily: 'Times-Bold',
  },
  dateIssued: {
    fontSize: 12,
    marginBottom: 18,
  },
  patientSection: {
    marginBottom: 18,
  },
  letterBody: {
    marginBottom: 18,
    lineHeight: 1.5,
  },
  paragraph: {
    marginBottom: 12,
    textAlign: 'justify',
    lineHeight: 1.5,
  },
  concernHeader: {
    marginBottom: 12,
  },
  dateRange: {
    marginTop: 12,
    marginBottom: 12,
  },
  dateRangeLabel: {
    fontFamily: 'Times-Bold',
    marginBottom: 3,
  },
  returnText: {
    marginBottom: 12,
    textAlign: 'justify',
    lineHeight: 1.5,
  },
  boldText: {
    fontFamily: 'Times-Bold',
  },
  closing: {
    marginTop: 10,
    marginBottom: 20,
  },
  signatureLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  signatureImage: {
    width: 120,
    height: 40,
    marginBottom: 5,
    objectFit: 'contain',
  },
  doctorName: {
    fontSize: 12,
    fontFamily: 'Times-Bold',
  },
  npiNumber: {
    fontSize: 12,
    marginTop: 2,
  },
})

/**
 * Format date as MM/DD/YYYY
 * Uses UTC methods to avoid timezone conversion issues
 */
function formatDate(date: Date): string {
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
  const dobFormatted = formatDate(patientDateOfBirth)

  // Get state-specific medical license
  const stateLicense = getStateLicense(submissionData.state)

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap={false}>
        {/* Header Section - Modern design with light blue background */}
        <View style={styles.headerSection}>
          {/* Contact information (LEFT) */}
          <View style={styles.headerLeft}>
            <Text style={styles.servingStates}>Proudly Serving Patients in Over 40 States</Text>
            <Link src="mailto:hello@platinumhealthclinic.com" style={styles.emailLink}>
              <Text>Email: hello@platinumhealthclinic.com</Text>
            </Link>
            <Text style={styles.headerLine}>Phone: 786-292-3730</Text>
            <Text style={styles.headerLine}>Fax: 786-289-9316</Text>
          </View>

          {/* Clinic name (RIGHT) */}
          <View style={styles.headerRight}>
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
                    Furthermore, the above-named caregiver <Text style={styles.boldText}>may return {notePurpose === 'other' ? '' : `to ${excuseFrom} `}after {lastDayFormatted}, with no restrictions.</Text> If you have any questions related to this matter or need further verification, please do not hesitate to contact our office. Our email and phone number are noted above.
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
                    Furthermore, the above-named patient <Text style={styles.boldText}>may return {notePurpose === 'other' ? '' : `to ${excuseFrom} `}after {lastDayFormatted}, with no restrictions.</Text> If you have any questions related to this matter or need further verification, please do not hesitate to contact our office. Our email and phone number are noted above.
                  </Text>
                </>
              )}

              <Text style={styles.paragraph}>Thank you,</Text>
            </View>

            {/* Signature Section */}
            <View style={styles.closing}>
              <Text style={styles.signatureLabel}>Signature:</Text>
              {doctorInfo.signatureUrl && (
                <Image
                  src={doctorInfo.signatureUrl}
                  style={styles.signatureImage}
                />
              )}

              <Text style={styles.doctorName}>
                Physician Name: {doctorInfo.name}, {doctorInfo.credentials}
              </Text>
              {stateLicense && (
                <Text style={styles.npiNumber}>
                  {stateLicense.stateName} Medical License Number: {stateLicense.licenseNumber}
                </Text>
              )}
            </View>
        </View>
      </Page>
    </Document>
  )
}

export default DoctorNoteTemplate
