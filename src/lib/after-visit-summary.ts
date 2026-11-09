import type { PriorChart } from '@/db/submissions'
import { SubmissionStatus, type JsonValue, type Submission } from '@/db/types'
import {
  addDays,
  ageOn,
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
  history: PriorChart[]
  rollingLimit: { usedDays: number; requestedDays: number; totalDays: number; exceeded: boolean }
  physician: { name: string; credentials: string }
  freeText: FreeTextChoices
}

export const FREE_TEXT_ANSWER_LABELS = {
  otherNotePurpose: 'Other note purpose',
  otherAbsenceReason: 'Other absence reason',
  otherSymptomText: 'Other symptom',
  additionalInformation: 'Additional information',
} as const

export type FreeTextAnswer = keyof typeof FREE_TEXT_ANSWER_LABELS

export type FreeTextChoices = Partial<Record<FreeTextAnswer, string>>

type FreeTextSource = Pick<
  Submission,
  | 'notePurpose'
  | 'otherNotePurpose'
  | 'absenceReason'
  | 'otherAbsenceReason'
  | 'symptoms'
  | 'otherSymptomText'
  | 'additionalInformation'
>

export function freeTextAnswers(submission: FreeTextSource): FreeTextChoices {
  const answers: Record<FreeTextAnswer, string | null> = {
    otherNotePurpose: submission.notePurpose === 'other' ? submission.otherNotePurpose : null,
    otherAbsenceReason: submission.absenceReason === 'Other' ? submission.otherAbsenceReason : null,
    otherSymptomText:
      Array.isArray(submission.symptoms) && submission.symptoms.includes('Other')
        ? submission.otherSymptomText
        : null,
    additionalInformation: submission.additionalInformation,
  }
  const filled: FreeTextChoices = {}
  for (const field of Object.keys(FREE_TEXT_ANSWER_LABELS) as FreeTextAnswer[]) {
    const text = answers[field]?.trim()
    if (text) filled[field] = text
  }
  return filled
}

function chosenFreeText(submission: FreeTextSource, freeText: unknown): FreeTextChoices {
  if (typeof freeText !== 'object' || freeText === null || Array.isArray(freeText)) {
    throw new Error('The free-text choices are missing')
  }
  const answers = freeTextAnswers(submission)
  const chosen: FreeTextChoices = {}
  for (const [field, text] of Object.entries(freeText)) {
    if (!Object.hasOwn(FREE_TEXT_ANSWER_LABELS, field)) {
      throw new Error(`Unknown free-text answer: ${field}`)
    }
    const answer = field as FreeTextAnswer
    const label = FREE_TEXT_ANSWER_LABELS[answer]
    if (!Object.hasOwn(answers, answer)) throw new Error(`This chart has no ${label.toLowerCase()}`)
    if (typeof text !== 'string' || !text.trim()) throw new Error(`${label} is empty`)
    chosen[answer] = text.trim()
  }
  return chosen
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

function historyLine(chart: PriorChart, doctorName: string): string {
  const first = dateOnlyFromUtcDate(chart.firstDayOff)
  const last = dateOnlyFromUtcDate(chart.lastDayOff)
  const day = formatDateOnly(todayET(instantOf(chart.reviewedAt ?? chart.createdAt)), 'long')
  const outcome =
    HISTORY_STATUS_TEXT[chart.status] ??
    `${chart.status === SubmissionStatus.APPROVED ? 'approved' : 'denied'} by Dr. ${doctorName}`
  const symptoms = symptomList(chart.symptoms, chart.otherSymptomText)
  const reason = reasonText(chart.absenceReason, chart.otherAbsenceReason)
  const dueTo = symptoms.length > 0 ? `${reason} (${symptoms.join(', ')})` : reason
  return `${day}: [${purposeText(chart.notePurpose, chart.otherNotePurpose)}] doctor note ${outcome} for ${dayCount(inclusiveDayCount(first, last))} (${formatDateOnlyRange(first, last)}), due to ${dueTo}.`
}

export function buildAfterVisitSummary({
  submission,
  history,
  rollingLimit,
  physician,
  freeText,
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
  const chosen = chosenFreeText(submission, freeText)
  const purpose = purposeText(submission.notePurpose, chosen.otherNotePurpose ?? null)
  const signedOn = todayET(instantOf(submission.reviewedAt))
  const childWorkAndSchool =
    submission.notePurpose === 'both' &&
    ageOn(dateOnlyFromUtcDate(submission.patientDateOfBirth), signedOn) < 16
  const workOrSchool = childWorkAndSchool ? 'work (parent/guardian) or school' : 'work or school'
  const absentFrom = childWorkAndSchool ? workOrSchool : purpose

  const symptoms = symptomList(submission.symptoms, chosen.otherSymptomText ?? null)
  const reason = reasonText(submission.absenceReason, chosen.otherAbsenceReason ?? null)

  return {
    signedAt: formatInstantETStamp(instantOf(submission.reviewedAt)),
    clinician: `${signer} | ${license.stateName} License #${license.licenseNumber}`,
    signer,
    patient: `${submission.patientFirstName} ${submission.patientLastName} | DOB: ${numeric(dateOnlyFromUtcDate(submission.patientDateOfBirth))}`,
    patientLocation: submission.state,
    encounterModality: 'Asynchronous',
    identityVerifiedBy: guardianFiled ? 'Parent/guardian provided' : 'Patient provided',
    consent: `The ${requester} requested an evaluation for sick leave documentation and consented to review of the submitted information. The ${requester} also consented that no physical examination, or independently measured vital signs would be performed and that an in-person or synchronous evaluation may be required.`,
    reasonForRequest:
      submission.notePurpose !== 'other'
        ? `Absence from ${absentFrom}`
        : chosen.otherNotePurpose
          ? `Other: ${chosen.otherNotePurpose}`
          : 'Other',
    requestedDates: `${offDates}. Return date: ${numeric(addDays(last, 1))}`,
    symptoms: symptoms.length > 0 ? `${reason}; symptoms: ${symptoms.join(', ')}` : reason,
    redFlags: rollingLimit.exceeded
      ? `30-day limit exceeded: ${dayCount(rollingLimit.usedDays)} approved in the prior 30 days + ${rollingLimit.requestedDays} requested = ${dayCount(rollingLimit.totalDays)}`
      : 'None',
    medicalHistory: history.map((chart) => historyLine(chart, doctorName)),
    additionalInformation: chosen.additionalInformation ?? null,
    assessment: `Based on the ${requester}-submitted history and available records, the information is ${approved ? '' : 'not '}sufficient to support the requested sick leave status determination.`,
    determination: approved
      ? [
          `Status: Excused from ${absentFrom}`,
          days === 1
            ? `Effective date: ${numeric(first)}`
            : `Effective dates: ${numeric(first)} through ${numeric(last)}`,
        ]
      : ['Status: Denied'],
    plan: approved ? 'Sick note: issued' : 'Sick note: denied',
    planNote: approved
      ? `The note includes only information necessary to communicate sick leave status from ${workOrSchool}.`
      : null,
    attestation:
      'I personally reviewed the completed branching questionnaire, documentation from any prior encounters and any submitted records. The work-status determination above reflects my independent medical judgment based on the information available at the time of review.',
  }
}
