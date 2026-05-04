export const MAYBE_REASONS = [
  {
    value: 'DATES_EXCEED_ALLOWED_RANGE',
    label: 'Dates exceed allowed range',
    description: 'Request covers more days than allowed under telehealth guidelines.',
    sendsEmail: true,
    emailMessage:
      'The doctor reviewed your intake form and request history. Based on our telehealth guidelines, we can only issue a note for a limited number of consecutive days within the applicable 30-day period.\n\nPlease reply and let us know if you would like to modify the dates or prefer a refund. If you would like to modify the dates, please include the first date you would like excused.',
  },
  {
    value: 'REQUESTING_ACCOMMODATIONS',
    label: 'Requesting accommodations/restrictions',
    description: 'Request includes accommodation or restriction language.',
    sendsEmail: true,
    emailMessage:
      'We reviewed your intake form and wanted to let you know that we can authorize a note for the requested dates, but we are not able to include accommodations or restrictions as requested.\n\nPlease let us know if you would still like a note or prefer a refund.',
  },
  {
    value: 'PARENT_CHILD_NOTE_CLARIFICATION',
    label: 'Parent / child 2 notes vs 1 note needed',
    description: 'Request needs clarification on caregiver, child, or both.',
    sendsEmail: true,
    emailMessage:
      'The doctor is reviewing your chart and would like to clarify your request. Do you need a note for yourself as a caregiver for work, a note for your child for school, or both?\n\nPlease let us know.',
  },
  {
    value: 'APPOINTMENTS_MORE_THAN_1_DAY',
    label: 'Appointments for more than 1 day',
    description: 'Appointment-related documentation covers more than one day.',
    sendsEmail: true,
    emailMessage:
      "The doctor reviewed your intake form and needs additional details as to why you need more than 1 day off for a doctor's appointment. Did you have multiple appointments or a medical procedure?\n\nIf you did not have an appointment and are requesting time off due to an illness, please reply with a brief description of your symptoms so we can update your chart accordingly.",
  },
  {
    value: 'OTHER_REVIEW',
    label: 'Other - needs additional information or further review',
    description: 'Generic customer update for additional review.',
    sendsEmail: true,
    emailMessage:
      'The doctor is reviewing your intake form and needs additional time to complete the review. We appreciate your patience.',
  },
  {
    value: 'ADDITIONAL_EMPLOYER_LANGUAGE',
    label: 'Additional employer language',
    description: 'Request asks for serious-health-condition or employer-specific language.',
    sendsEmail: true,
    emailMessage:
      'The doctor reviewed your intake form, and unfortunately, we cannot include the additional language you requested in the note. We can provide our standard note, and if your employer requires additional forms to be completed, we will review them and try to assist.\n\nPlease let us know if you would still like a note or prefer a refund.',
  },
  {
    value: 'DATES_IN_ADVANCE',
    label: 'Dates in advance',
    description: 'Request asks for dates too far in advance for a current illness.',
    sendsEmail: true,
    emailMessage:
      'The doctor reviewed your intake form and needs additional details regarding your request for a note covering dates so far in advance for a current illness.\n\nPlease reply with why these future dates are needed, or let us know if you would like to modify the requested dates.',
  },
  {
    value: 'INTERNAL_ONLY',
    label: 'Other - no message sent, internal issue',
    description: 'Internal cleanup or staff-only review.',
    sendsEmail: false,
    emailMessage: '',
  },
] as const

export type MaybeReason = (typeof MAYBE_REASONS)[number]['value']

export type MaybeReasonConfig = (typeof MAYBE_REASONS)[number]

export const DEFAULT_MAYBE_REASON: MaybeReason = 'OTHER_REVIEW'
export const DATES_EXCEED_ALLOWED_RANGE_REASON: MaybeReason = 'DATES_EXCEED_ALLOWED_RANGE'
export const INTERNAL_ONLY_MAYBE_REASON: MaybeReason = 'INTERNAL_ONLY'

export function getMaybeReasonConfig(reason: string | null | undefined): MaybeReasonConfig | null {
  return MAYBE_REASONS.find((item) => item.value === reason) ?? null
}

export function isMaybeReason(reason: string): reason is MaybeReason {
  return getMaybeReasonConfig(reason) !== null
}

export function getMaybeReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'No reason recorded'
  return getMaybeReasonConfig(reason)?.label ?? 'Unknown reason'
}

export function maybeReasonSendsEmail(reason: string | null | undefined): boolean {
  return getMaybeReasonConfig(reason)?.sendsEmail ?? false
}
