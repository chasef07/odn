export const MAYBE_REASONS = [
  {
    value: 'DATES_EXCEED_ALLOWED_RANGE',
    label: 'Dates exceed allowed range',
    description: 'Request covers more days than allowed under telehealth guidelines.',
    sendsEmail: true,
    requiresApprovedDays: true,
    emailMessage: '',
  },
  {
    value: 'REQUESTING_ACCOMMODATIONS',
    label: 'Requesting accommodations/restrictions',
    description: 'Request includes accommodation or restriction language.',
    sendsEmail: true,
    requiresApprovedDays: false,
    emailMessage:
      'We reviewed your intake form and wanted to let you know that we can authorize a note for the requested dates, but we are not able to include accommodations or restrictions as requested.\n\nPlease let us know if you would still like a note or prefer a refund.',
  },
  {
    value: 'PARENT_CHILD_NOTE_CLARIFICATION',
    label: 'Parent / child 2 notes vs 1 note needed',
    description: 'Request needs clarification on caregiver, child, or both.',
    sendsEmail: true,
    requiresApprovedDays: false,
    emailMessage:
      'The doctor is reviewing your chart and would like to clarify your request. Do you need a note for yourself as a caregiver for work, a note for your child for school, or both?\n\nPlease let us know.',
  },
  {
    value: 'APPOINTMENTS_MORE_THAN_1_DAY',
    label: 'Appointments for more than 1 day',
    description: 'Appointment-related documentation covers more than one day.',
    sendsEmail: true,
    requiresApprovedDays: false,
    emailMessage:
      "The doctor reviewed your intake form and needs additional details as to why you need more than 1 day off for a doctor's appointment. Did you have multiple appointments or a medical procedure?\n\nIf you did not have an appointment and are requesting time off due to an illness, please reply with a brief description of your symptoms so we can update your chart accordingly.",
  },
  {
    value: 'OTHER_REVIEW',
    label: 'Other - needs additional information or further review',
    description: 'Generic customer update for additional review.',
    sendsEmail: true,
    requiresApprovedDays: false,
    emailMessage:
      'The doctor is reviewing your intake form and needs additional time to complete the review. We appreciate your patience.',
  },
  {
    value: 'MORE_INFO_NEEDED',
    label: 'More Info Needed',
    description: 'Request additional details for the chart and doctor review.',
    sendsEmail: true,
    requiresApprovedDays: false,
    emailMessage:
      'Can you please provide additional details regarding your appointment, injury, or medical condition? We will add this information to your chart for the doctor’s review. However, we will not include it on your note unless you request that we do so.\n\nPlease reply directly to this email with the additional details.',
  },
  {
    value: 'ADDITIONAL_EMPLOYER_LANGUAGE',
    label: 'Additional employer language',
    description: 'Request asks for serious-health-condition or employer-specific language.',
    sendsEmail: true,
    requiresApprovedDays: false,
    emailMessage:
      'The doctor reviewed your intake form, and unfortunately, we cannot include the additional language you requested in the note. We can provide our standard note, and if your employer requires additional forms to be completed, we will review them and try to assist.\n\nPlease let us know if you would still like a note or prefer a refund.',
  },
  {
    value: 'DATES_IN_ADVANCE',
    label: 'Dates in advance',
    description: 'Request asks for dates too far in advance for a current illness.',
    sendsEmail: true,
    requiresApprovedDays: false,
    emailMessage:
      'The doctor reviewed your intake form and needs additional details regarding your request for a note covering dates so far in advance for a current illness.\n\nPlease reply with why these future dates are needed, or let us know if you would like to modify the requested dates.',
  },
  {
    value: 'UNDER_18',
    label: 'Under 18 - parent/guardian authorization needed',
    description: 'Patient is under 18 and needs parent or guardian authorization.',
    sendsEmail: true,
    requiresApprovedDays: false,
    emailMessage:
      'We reviewed your intake form and noticed that you are under the age of 18. In order to assist you, we require authorization from a parent or guardian.\n\nPlease have your parent or guardian email us from their email address to confirm their authorization and include their full name and date of birth.',
  },
  {
    value: 'INTERNAL_ONLY',
    label: 'Other - no message sent, internal issue',
    description: 'Internal cleanup or staff-only review.',
    sendsEmail: false,
    requiresApprovedDays: false,
    emailMessage: '',
  },
] as const

export const MAYBE_APPROVED_DAY_OPTIONS = [1, 2, 3, 4, 5] as const

export type MaybeReason = (typeof MAYBE_REASONS)[number]['value']

export type MaybeReasonConfig = (typeof MAYBE_REASONS)[number]

export type MaybeApprovedDays = (typeof MAYBE_APPROVED_DAY_OPTIONS)[number]

export const DEFAULT_MAYBE_REASON: MaybeReason = 'OTHER_REVIEW'
export const DATES_EXCEED_ALLOWED_RANGE_REASON: MaybeReason = 'DATES_EXCEED_ALLOWED_RANGE'
export const MORE_INFO_NEEDED_REASON: MaybeReason = 'MORE_INFO_NEEDED'
export const INTERNAL_ONLY_MAYBE_REASON: MaybeReason = 'INTERNAL_ONLY'

export function getMaybeReasonConfig(reason: string | null | undefined): MaybeReasonConfig | null {
  return MAYBE_REASONS.find((item) => item.value === reason) ?? null
}

export function getMaybeReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'No reason recorded'
  return getMaybeReasonConfig(reason)?.label ?? 'Unknown reason'
}

export function maybeReasonRequiresApprovedDays(reason: string | null | undefined): boolean {
  return getMaybeReasonConfig(reason)?.requiresApprovedDays ?? false
}

export function isMaybeApprovedDays(value: number): value is MaybeApprovedDays {
  return MAYBE_APPROVED_DAY_OPTIONS.some((days) => days === value)
}

export function getMaybeEmailMessage({
  reason,
  approvedDays,
}: {
  reason: MaybeReason
  approvedDays?: MaybeApprovedDays | null
}) {
  if (reason === DATES_EXCEED_ALLOWED_RANGE_REASON && approvedDays) {
    if (approvedDays === 1) {
      return [
        'The doctor reviewed your intake form and your previous charts with us and unfortunately, we can only issue a note for 1 day. This is based on our telehealth guidelines for the number of days allowed in a 30-day period.',
        'Please let us know if you want to modify the dates or prefer a refund. If you would like to modify the dates, please reply with the date you would like excused.',
      ]
    }

    return [
      `The doctor reviewed your intake form and previous charts with us and unfortunately, we can only issue a note for up to ${approvedDays} consecutive days. This is based on our telehealth guidelines for the number of days allowed in a 30-day period.`,
      'Please let us know if you want to modify the dates or prefer a refund. If you would like to modify the dates, please reply with the first day you would like excused.',
    ]
  }

  const reasonConfig = getMaybeReasonConfig(reason) ?? getMaybeReasonConfig(DEFAULT_MAYBE_REASON)
  return reasonConfig?.emailMessage ? reasonConfig.emailMessage.split('\n\n') : []
}
