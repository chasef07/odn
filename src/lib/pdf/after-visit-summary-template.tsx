import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { AfterVisitSummary } from '../after-visit-summary'

function stylesFor(scale: number) {
  const s = (size: number) => size * scale
  return StyleSheet.create({
    page: {
      paddingVertical: s(36),
      paddingHorizontal: s(48),
      fontFamily: 'Helvetica',
      fontSize: s(10),
      lineHeight: 1.3,
      color: '#111827',
    },
    title: {
      fontSize: s(15),
      fontFamily: 'Helvetica-Bold',
      marginBottom: s(8),
    },
    heading: {
      fontSize: s(11.5),
      fontFamily: 'Helvetica-Bold',
      marginTop: s(9),
      marginBottom: s(3),
    },
    label: {
      fontFamily: 'Helvetica-Bold',
    },
    bullet: {
      flexDirection: 'row',
      marginTop: s(2),
    },
    bulletMark: {
      width: s(12),
    },
    bulletText: {
      flex: 1,
    },
    historyLine: {
      marginLeft: s(24),
      marginTop: s(2),
    },
    signature: {
      width: s(135),
      height: s(45),
      objectFit: 'contain',
      marginTop: s(6),
    },
  })
}

type Styles = ReturnType<typeof stylesFor>

function Field({
  label,
  value,
  styles,
}: {
  label: string
  value: string
  styles: Styles
}): React.ReactElement {
  return (
    <Text>
      <Text style={styles.label}>{label}:</Text> {value}
    </Text>
  )
}

function Bullet({
  children,
  styles,
}: {
  children: React.ReactNode
  styles: Styles
}): React.ReactElement {
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
  scale = 1,
  historyLimit = summary.medicalHistory.length,
}: {
  summary: AfterVisitSummary
  signatureUrl: string
  scale?: number
  historyLimit?: number
}): React.ReactElement {
  const styles = stylesFor(scale)
  const listedHistory = summary.medicalHistory.slice(0, historyLimit)
  const unlistedHistory = summary.medicalHistory.length - listedHistory.length
  return (
    <Document title="Sick Leave Evaluation">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Sick Leave Evaluation</Text>
        <Field styles={styles} label="Date/Time" value={summary.signedAt} />
        <Field styles={styles} label="Clinician" value={summary.clinician} />
        <Field styles={styles} label="Patient" value={summary.patient} />
        <Field styles={styles} label="Patient Location" value={summary.patientLocation} />
        <Field styles={styles} label="Encounter Modality" value={summary.encounterModality} />
        <Field styles={styles} label="Identity Verified By" value={summary.identityVerifiedBy} />

        <Text style={styles.heading}>Consent and Scope</Text>
        <Text>{summary.consent}</Text>
        <Text>Physician attestation of prior record reviewed: yes</Text>

        <Text style={styles.heading}>Reason for Request</Text>
        <Text>{summary.reasonForRequest}</Text>

        <Text style={styles.heading}>Questionnaire Reviewed</Text>
        <Bullet styles={styles}>Requested dates: {summary.requestedDates}</Bullet>
        <Bullet styles={styles}>Symptoms and onset: {summary.symptoms}</Bullet>
        <Bullet styles={styles}>Red-flag screening responses: {summary.redFlags}</Bullet>
        <Bullet styles={styles}>Relevant medical history:</Bullet>
        {summary.medicalHistory.length === 0 && (
          <Text style={styles.historyLine}>No prior charts on file</Text>
        )}
        {listedHistory.map((line) => (
          <Text key={line} style={styles.historyLine}>
            {line}
          </Text>
        ))}
        {unlistedHistory > 0 && (
          <Text style={styles.historyLine}>
            Plus {unlistedHistory} earlier {unlistedHistory === 1 ? 'chart' : 'charts'} on file, not
            listed here.
          </Text>
        )}
        {summary.additionalInformation && (
          <Bullet styles={styles}>Additional information: {summary.additionalInformation}</Bullet>
        )}

        <Text style={styles.heading}>Assessment</Text>
        <Text>{summary.assessment}</Text>
        <Text>Asynchronous assessment performed: yes</Text>

        <Text style={styles.heading}>Sick Leave Determination</Text>
        {summary.determination.map((line) => (
          <Bullet styles={styles} key={line}>
            {line}
          </Bullet>
        ))}

        <Text style={styles.heading}>Plan</Text>
        <Bullet styles={styles}>{summary.plan}</Bullet>
        {summary.planNote && <Text>{summary.planNote}</Text>}

        <View wrap={false}>
          <Text style={styles.heading}>Physician Attestation</Text>
          <Text>{summary.attestation}</Text>
          <Image src={signatureUrl} style={styles.signature} />
          <Field styles={styles} label="Signed" value={summary.signer} />
          <Field styles={styles} label="Date/time signed" value={summary.signedAt} />
        </View>
      </Page>
    </Document>
  )
}
