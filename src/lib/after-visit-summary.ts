import type { PatientHistorySubmission } from '@/db/submissions'
import { SubmissionStatus, type JsonValue, type Submission } from '@/db/types'
import {
  addDays,
  dateOnlyFromUtcDate,
  formatDateOnly,
  formatDateOnlyRange,
  formatInstantETStamp,
  inclusiveDayCount,
  instantOf,
  todayET,
  type DateOnly,
} from '@/lib/dates'
import { getStateLicense } from '@/lib/state-licenses'

export type AfterVisitSummaryInput = {
  submission: Submission
  history: PatientHistorySubmission[]
  rollingLimit: { usedDays: number; requestedDays: number; totalDays: number; exceeded: boolean }
  physician: { name: string; credentials: string }
  includeAdditionalInformation: boolean
}

export type AfterVisitSummary = {
  signedAt: string
  clinician: string
  signer: string
  patient: string
  patientLocation: string
  encounterModality: string
  identityVerifiedBy: string
  consent: string
  reasonForRequest: string
  requestedDates: string
  symptoms: string
  redFlags: string
  medicalHistory: string[]
  additionalInformation: string | null
  assessment: string
  determination: string[]
  plan: string
  planNote: string | null
  attestation: string
}

const HISTORY_STATUS_TEXT: Record<SubmissionStatus, string | null> = {
  APPROVED: null,
  DENIED: null,
  PENDING_REVIEW: 'request pending review',
  MAYBE: 'request awaiting more information',
  MANUAL: 'request in manual review',
}

function numeric(day: DateOnly): string {
  return formatDateOnly(day, 'numeric')
}

function dayCount(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

function purposeText(notePurpose: string, otherNotePurpose: string | null): string {
  if (notePurpose === 'both') return 'work and school'
  if (notePurpose === 'other') return otherNotePurpose?.trim() || 'other'
  return notePurpose
}

function reasonText(absenceReason: string, otherAbsenceReason: string | null): string {
  return absenceReason === 'Other' && otherAbsenceReason?.trim()
    ? otherAbsenceReason.trim()
    : absenceReason
}

function symptomList(symptoms: JsonValue | null, otherSymptomText: string | null): string[] {
  if (!Array.isArray(symptoms)) return []
  return symptoms
    .filter((symptom): symptom is string => typeof symptom === 'string')
    .map((symptom) =>
      symptom === 'Other' && otherSymptomText?.trim()
        ? `Other: ${otherSymptomText.trim()}`
        : symptom
    )
}

function historyLine(chart: PatientHistorySubmission, doctorName: string): string {
  const first = dateOnlyFromUtcDate(chart.firstDayOff)
  const last = dateOnlyFromUtcDate(chart.lastDayOff)
  const day = formatDateOnly(todayET(instantOf(chart.reviewedAt ?? chart.createdAt)), 'long')
  const outcome =
    HISTORY_STATUS_TEXT[chart.status] ??
    `${chart.status === SubmissionStatus.APPROVED ? 'approved' : 'denied'} by Dr. ${doctorName}`
  const symptoms = symptomList(chart.symptoms, chart.otherSymptomText)
  const reason = reasonText(chart.absenceReason, chart.otherAbsenceReason)
  const dueTo = symptoms.length > 0 ? `${reason} (${symptoms.join(', ')})` : reason
  return `${day}: [${purposeText(chart.notePurpose, null)}] doctor note ${outcome} for ${dayCount(inclusiveDayCount(first, last))} (${formatDateOnlyRange(first, last)}), due to ${dueTo}.`
}

export function buildAfterVisitSummary({
  submission,
  history,
  rollingLimit,
  physician,
  includeAdditionalInformation,
}: AfterVisitSummaryInput): AfterVisitSummary {
  const approved = submission.status === SubmissionStatus.APPROVED
  if ((!approved && submission.status !== SubmissionStatus.DENIED) || !submission.reviewedAt) {
    throw new Error('Only approved or denied charts have an after-visit summary')
  }

  const license = getStateLicense(submission.state)
  if (!license) throw new Error(`No license on file for ${submission.state}`)

  const doctorName = physician.name.trim().replace(/^dr\.?\s+/i, '')
  const signer = `${doctorName}, ${physician.credentials.trim()}`
  const guardianFiled = submission.recipient === 'someone_else'
  const requester = guardianFiled ? 'parent/guardian' : 'patient'

  const first = dateOnlyFromUtcDate(submission.firstDayOff)
  const last = dateOnlyFromUtcDate(submission.lastDayOff)
  const days = inclusiveDayCount(first, last)
  const offDates =
    days === 1
      ? `Off date: ${numeric(first)}`
      : `Off dates: ${numeric(first)} ${days === 2 ? 'and' : 'through'} ${numeric(last)}`
  const purpose = purposeText(submission.notePurpose, submission.otherNotePurpose)

  const symptoms = symptomList(submission.symptoms, submission.otherSymptomText)
  const reason = reasonText(submission.absenceReason, submission.otherAbsenceReason)
  const additionalInformation = submission.additionalInformation?.trim() || null
  const priorCharts = history.filter((chart) => chart.createdAt < submission.createdAt)

  return {
    signedAt: formatInstantETStamp(instantOf(submission.reviewedAt)),
    clinician: `${signer} | ${license.stateName} License #${license.licenseNumber}`,
    signer,
    patient: `${submission.patientFirstName} ${submission.patientLastName} | DOB: ${numeric(dateOnlyFromUtcDate(submission.patientDateOfBirth))}`,
    patientLocation: submission.state,
    encounterModality: 'Asynchronous',
    identityVerifiedBy: guardianFiled ? 'Parent/guardian provided' : 'Patient provided',
    consent: `The ${requester} requested an evaluation for sick leave documentation and consented to review of the submitted information. The ${requester} was informed that no physical examination, or independently measured vital signs were performed and that an in-person or synchronous evaluation may be required. Physician attestation of prior record reviewed: yes`,
    reasonForRequest:
      submission.notePurpose === 'other' ? `Other: ${purpose}` : `Absence from ${purpose}`,
    requestedDates: `${offDates}. Return date: ${numeric(addDays(last, 1))}`,
    symptoms: symptoms.length > 0 ? `${reason}; symptoms: ${symptoms.join(', ')}` : reason,
    redFlags: rollingLimit.exceeded
      ? `30-day limit exceeded: ${dayCount(rollingLimit.usedDays)} approved in the prior 30 days + ${rollingLimit.requestedDays} requested = ${dayCount(rollingLimit.totalDays)}`
      : 'None',
    medicalHistory:
      priorCharts.length > 0
        ? priorCharts.map((chart) => historyLine(chart, doctorName))
        : ['No prior charts on file'],
    additionalInformation: includeAdditionalInformation ? additionalInformation : null,
    assessment: `Based on the ${requester}-submitted history and available records, the information is ${approved ? '' : 'not '}sufficient to support the requested sick leave status determination.`,
    determination: approved
      ? [
          `Status: Excused from ${purpose}`,
          days === 1
            ? `Effective date: ${numeric(first)}`
            : `Effective dates: ${numeric(first)} through ${numeric(last)}`,
        ]
      : ['Status: Denied'],
    plan: approved ? 'Sick note: issued' : 'Sick note: denied',
    planNote: approved
      ? 'The note includes only information necessary to communicate sick leave status from work or school.'
      : null,
    attestation:
      'I personally reviewed the completed branching questionnaire, documentation from any prior encounters and any submitted records. The work-status determination above reflects my independent medical judgment based on the information available at the time of review.',
  }
}
