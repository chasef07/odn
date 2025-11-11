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
} from '@react-pdf/renderer'

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
  licenseNumber: string
  signatureUrl: string
}

interface DoctorNoteTemplateProps {
  submissionData: DoctorNoteData
  doctorInfo: DoctorInfo
  issueDate: Date
}

// Create styles - Times New Roman 12pt, simplified layout with professional letterhead
const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 12,
    fontFamily: 'Times-Roman',
    backgroundColor: '#ffffff',
    lineHeight: 1.5,
    border: '1pt solid #E2E8F0', // Subtle border around entire document
  },
  headerSection: {
    backgroundColor: '#F0F4F8', // Light blue-gray letterhead
    padding: 20,
    paddingLeft: 72,
    paddingRight: 72,
    borderBottom: '1pt solid #CBD5E1', // Subtle separator
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
    marginBottom: 2,
    color: '#475569', // Slightly darker gray for contrast
  },
  clinicName: {
    fontSize: 14,
    fontFamily: 'Times-Bold',
    marginBottom: 4,
    color: '#1e40af', // Professional blue color
  },
  contentSection: {
    paddingLeft: 72,
    paddingRight: 72,
    paddingTop: 20,
    paddingBottom: 72,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  dateIssued: {
    fontSize: 12,
    marginBottom: 20,
  },
  patientSection: {
    marginBottom: 20,
  },
  patientLine: {
    fontSize: 12,
    marginBottom: 4,
  },
  letterBody: {
    marginBottom: 20,
    lineHeight: 1.5,
  },
  paragraph: {
    marginBottom: 12,
    textAlign: 'justify',
  },
  dateRange: {
    marginTop: 12,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Times-Bold',
  },
  closing: {
    marginBottom: 40,
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
 */
function formatDate(date: Date): string {
  const d = new Date(date)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const year = d.getFullYear()
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
  } = submissionData

  const patientFullName = `${patientFirstName} ${patientLastName}`
  const isMinor = recipient === 'someone_else'
  const guardianFullName = isMinor && guardianFirstName && guardianLastName
    ? `${guardianFirstName} ${guardianLastName}`
    : null

  const excuseFrom = formatExcuseFrom(notePurpose, otherNotePurpose)
  const dateIssuedFormatted = formatDate(issueDate)
  const firstDayFormatted = formatDate(firstDayOff)
  const lastDayFormatted = formatDate(lastDayOff)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header Section - Professional Letterhead */}
        <View style={styles.headerSection}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLine}>Proudly serving patients in over 40 states</Text>
            <Text style={styles.headerLine}>Email: hello@platinumhealthclinic.com</Text>
            <Text style={styles.headerLine}>Phone: (917) 300-8543</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.clinicName}>Platinum Health Clinic</Text>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Title */}
          <Text style={styles.title}>Medical Excuse Note</Text>

          {/* Date Issued */}
          <Text style={styles.dateIssued}>Date Issued: {dateIssuedFormatted}</Text>

          {/* Patient Information */}
          <View style={styles.patientSection}>
            <Text style={styles.patientLine}>Patient Name: {patientFullName}</Text>
            <Text style={styles.patientLine}>Date of Birth: {formatDate(patientDateOfBirth)}</Text>
            {guardianFullName && (
              <Text style={styles.patientLine}>Guardian: {guardianFullName}</Text>
            )}
          </View>

          {/* Letter Body */}
          <View style={styles.letterBody}>
            <Text style={styles.paragraph}>To Whom It May Concern:</Text>

            <Text style={styles.paragraph}>
              This note is to confirm that the above-named patient was evaluated on {dateIssuedFormatted}.
              Based on the assessment, please excuse this individual from {excuseFrom} and related activities
              for the following period due to a medical condition:
            </Text>

            <Text style={styles.dateRange}>
              {firstDayFormatted} through {lastDayFormatted}
            </Text>

            <Text style={styles.paragraph}>
              Furthermore, the above-named patient may return to {excuseFrom} after {lastDayFormatted}, with no
              restrictions. If you have any questions related to this matter or need further verification,
              please do not hesitate to contact our office. Our email and phone number are noted above.
            </Text>

            <Text style={styles.paragraph}>
              Thank you for your understanding.
            </Text>
          </View>

          {/* Signature Section */}
          <View style={styles.closing}>
            {doctorInfo.signatureUrl && (
              <Image
                src={doctorInfo.signatureUrl}
                style={styles.signatureImage}
              />
            )}

            <Text style={styles.doctorName}>
              {doctorInfo.name}, {doctorInfo.credentials}
            </Text>
            <Text style={styles.npiNumber}>
              NPI: {doctorInfo.licenseNumber}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export default DoctorNoteTemplate
