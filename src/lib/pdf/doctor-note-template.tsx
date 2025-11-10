/**
 * Doctor's Note PDF Template
 * Uses @react-pdf/renderer to generate professional medical excuse notes
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
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

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    borderBottom: 2,
    borderBottomColor: '#1e3a8a',
    paddingBottom: 15,
  },
  practiceName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
  },
  practiceSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
    marginTop: 10,
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1e3a8a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    width: 140,
    fontWeight: 'bold',
    color: '#334155',
  },
  value: {
    flex: 1,
    color: '#1e293b',
  },
  textBlock: {
    marginTop: 5,
    lineHeight: 1.5,
    color: '#1e293b',
  },
  signatureSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: 1,
    borderTopColor: '#e2e8f0',
  },
  signatureImage: {
    width: 150,
    height: 50,
    marginBottom: 5,
    objectFit: 'contain',
  },
  signatureLine: {
    borderBottom: 1,
    borderBottomColor: '#94a3b8',
    width: 200,
    marginBottom: 5,
  },
  doctorName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  doctorCredentials: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    paddingTop: 10,
    borderTop: 1,
    borderTopColor: '#e2e8f0',
  },
  referenceNumber: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 2,
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
 * Calculate number of days between two dates (inclusive)
 */
function calculateDaysDuration(startDate: Date, endDate: Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 for inclusive
  return diffDays
}

/**
 * Format note purpose for display
 */
function formatNotePurpose(purpose: string, other?: string | null): string {
  if (purpose === 'other' && other) {
    return other
  }

  const purposeMap: Record<string, string> = {
    work: 'Work',
    school: 'School',
    both: 'Work and School',
  }

  return purposeMap[purpose] || purpose
}

/**
 * Format absence reason for display
 */
function formatAbsenceReason(reason: string, other?: string | null): string {
  if (reason === 'other' && other) {
    return other
  }

  // Capitalize first letter and replace underscores with spaces
  return reason
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Doctor's Note PDF Template Component
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
    otherAbsenceReason,
    symptoms,
    otherSymptomText,
    additionalInformation,
    state,
    submissionId,
  } = submissionData

  const patientFullName = `${patientFirstName} ${patientLastName}`
  const isMinor = recipient === 'someone_else'
  const guardianFullName = isMinor && guardianFirstName && guardianLastName
    ? `${guardianFirstName} ${guardianLastName}`
    : null

  const daysDuration = calculateDaysDuration(firstDayOff, lastDayOff)
  const formattedPurpose = formatNotePurpose(notePurpose, otherNotePurpose)
  const formattedReason = formatAbsenceReason(absenceReason, otherAbsenceReason)

  // Parse symptoms from JSON if it's a string
  const symptomsList = symptoms
    ? Array.isArray(symptoms)
      ? symptoms
      : []
    : []

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.practiceName}>Online Doctor's Note</Text>
          <Text style={styles.practiceSubtitle}>Professional Medical Documentation Services</Text>
        </View>

        {/* Document Title */}
        <Text style={styles.title}>Medical Excuse Note</Text>

        {/* Issue Date */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Date Issued:</Text>
            <Text style={styles.value}>{formatDate(issueDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>State:</Text>
            <Text style={styles.value}>{state}</Text>
          </View>
        </View>

        {/* Patient Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Patient Name:</Text>
            <Text style={styles.value}>{patientFullName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date of Birth:</Text>
            <Text style={styles.value}>{formatDate(patientDateOfBirth)}</Text>
          </View>
          {guardianFullName && (
            <View style={styles.row}>
              <Text style={styles.label}>Guardian:</Text>
              <Text style={styles.value}>{guardianFullName}</Text>
            </View>
          )}
        </View>

        {/* Absence Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Absence Period</Text>
          <View style={styles.row}>
            <Text style={styles.label}>From:</Text>
            <Text style={styles.value}>{formatDate(firstDayOff)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>To:</Text>
            <Text style={styles.value}>{formatDate(lastDayOff)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Duration:</Text>
            <Text style={styles.value}>
              {daysDuration} {daysDuration === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Purpose:</Text>
            <Text style={styles.value}>{formattedPurpose}</Text>
          </View>
        </View>

        {/* Medical Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Reason for Absence:</Text>
            <Text style={styles.value}>{formattedReason}</Text>
          </View>

          {symptomsList.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Symptoms:</Text>
              <Text style={styles.value}>{symptomsList.join(', ')}</Text>
            </View>
          )}

          {otherSymptomText && (
            <View style={styles.row}>
              <Text style={styles.label}>Other Symptoms:</Text>
              <Text style={styles.value}>{otherSymptomText}</Text>
            </View>
          )}

          {additionalInformation && (
            <>
              <Text style={[styles.label, { marginTop: 8, marginBottom: 4 }]}>
                Additional Notes:
              </Text>
              <Text style={styles.textBlock}>{additionalInformation}</Text>
            </>
          )}
        </View>

        {/* Medical Statement */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={styles.textBlock}>
            This is to certify that {patientFullName} was unable to attend {formattedPurpose.toLowerCase()}
            {' '}from {formatDate(firstDayOff)} through {formatDate(lastDayOff)} due to medical reasons.
            {' '}This absence was medically necessary and excused.
          </Text>
        </View>

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          {/* Signature Image */}
          {doctorInfo.signatureUrl && (
            <Image
              src={doctorInfo.signatureUrl}
              style={styles.signatureImage}
            />
          )}

          {/* Signature Line */}
          <View style={styles.signatureLine} />

          {/* Doctor Information */}
          <Text style={styles.doctorName}>{doctorInfo.name}</Text>
          <Text style={styles.doctorCredentials}>
            {doctorInfo.credentials}
          </Text>
          <Text style={styles.doctorCredentials}>
            License Number: {doctorInfo.licenseNumber}
          </Text>
          <Text style={[styles.doctorCredentials, { marginTop: 5 }]}>
            Date: {formatDate(issueDate)}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.referenceNumber}>
            Reference: {submissionId.substring(0, 12).toUpperCase()}
          </Text>
          <Text>
            This document is a legitimate medical excuse note provided by a licensed medical professional.
          </Text>
          <Text>
            For verification purposes, please contact Online Doctor's Note at support@onlinedoctornote.com
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export default DoctorNoteTemplate
