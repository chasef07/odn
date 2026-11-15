import { NOTE_PURPOSE_LABELS } from '@/lib/admin-utils'

function withOtherText(answer: string, otherText: string | null | undefined): string {
  const text = otherText?.trim()
  return text ? `${answer}: ${text}` : answer
}

export function notePurposeAnswer(
  notePurpose: string,
  otherNotePurpose: string | null | undefined
): string {
  const label = NOTE_PURPOSE_LABELS[notePurpose] ?? notePurpose
  return notePurpose === 'other' ? withOtherText(label, otherNotePurpose) : label
}

export function absenceReasonAnswer(
  absenceReason: string,
  otherAbsenceReason: string | null | undefined
): string {
  return absenceReason === 'Other'
    ? withOtherText(absenceReason, otherAbsenceReason)
    : absenceReason
}

export function symptomAnswers(
  symptoms: unknown,
  otherSymptomText: string | null | undefined
): string[] {
  if (!Array.isArray(symptoms)) return []
  return symptoms
    .filter((symptom): symptom is string => typeof symptom === 'string')
    .map((symptom) => (symptom === 'Other' ? withOtherText(symptom, otherSymptomText) : symptom))
}
