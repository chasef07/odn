import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { AfterVisitSummary } from '../after-visit-summary'

const styles = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.4,
    color: '#111827',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  heading: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 4,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
  },
  bullet: {
    flexDirection: 'row',
    marginTop: 3,
  },
  bulletMark: {
    width: 12,
  },
  bulletText: {
    flex: 1,
  },
  historyLine: {
    marginLeft: 24,
    marginTop: 3,
  },
  signature: {
    width: 150,
    height: 50,
    objectFit: 'contain',
    marginTop: 10,
  },
})

function Field({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <Text>
      <Text style={styles.label}>{label}:</Text> {value}
    </Text>
  )
}

function Bullet({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <View style={styles.bullet} wrap={false}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

export function AfterVisitSummaryTemplate({
  summary,
  signatureUrl,
}: {
  summary: AfterVisitSummary
  signatureUrl: string
}): React.ReactElement {
  return (
    <Document title="Sick Leave Evaluation">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Sick Leave Evaluation</Text>
        <Field label="Date/Time" value={summary.signedAt} />
        <Field label="Clinician" value={summary.clinician} />
        <Field label="Patient" value={summary.patient} />
        <Field label="Patient Location" value={summary.patientLocation} />
        <Field label="Encounter Modality" value={summary.encounterModality} />
        <Field label="Identity Verified By" value={summary.identityVerifiedBy} />

        <Text style={styles.heading}>Consent and Scope</Text>
        <Text>{summary.consent}</Text>
        <Text>Physician attestation of prior record reviewed: yes</Text>

        <Text style={styles.heading}>Reason for Request</Text>
        <Text>{summary.reasonForRequest}</Text>

        <Text style={styles.heading}>Questionnaire Reviewed</Text>
        <Bullet>Requested dates: {summary.requestedDates}</Bullet>
        <Bullet>Symptoms and onset: {summary.symptoms}</Bullet>
        <Bullet>Red-flag screening responses: {summary.redFlags}</Bullet>
        <Bullet>Relevant medical history:</Bullet>
        {summary.medicalHistory.map((line) => (
          <Text key={line} style={styles.historyLine}>
            {line}
          </Text>
        ))}
        {summary.additionalInformation && (
          <Bullet>Additional information: {summary.additionalInformation}</Bullet>
        )}

        <Text style={styles.heading}>Assessment</Text>
        <Text>{summary.assessment}</Text>
        <Text>Asynchronous assessment performed: yes</Text>

        <Text style={styles.heading}>Sick Leave Determination</Text>
        {summary.determination.map((line) => (
          <Bullet key={line}>{line}</Bullet>
        ))}

        <Text style={styles.heading}>Plan</Text>
        <Bullet>{summary.plan}</Bullet>
        {summary.planNote && <Text>{summary.planNote}</Text>}

        <View wrap={false}>
          <Text style={styles.heading}>Physician Attestation</Text>
          <Text>{summary.attestation}</Text>
          <Image src={signatureUrl} style={styles.signature} />
          <Field label="Signed" value={summary.signer} />
          <Field label="Date/time signed" value={summary.signedAt} />
        </View>
      </Page>
    </Document>
  )
}
