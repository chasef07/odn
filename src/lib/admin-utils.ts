export type DenialReason =
  | 'Legal'
  | '7+ days'
  | 'Duplicate'
  | 'Refund (Customer)'
  | 'Refund (Denial)'
  | 'Under 18'
  | 'Accommodations'
  | 'Other'

export const DENIAL_REASON_OPTIONS: {
  value: DenialReason
  label: string
  description: string
  selectLabel: string
}[] = [
  {
    value: 'Legal',
    label: 'Jury Duty/Legal Matter',
    description: 'Request is for jury duty, court, or legal obligation (not medical)',
    selectLabel: 'Legal - Cannot provide note for this situation',
  },
  {
    value: '7+ days',
    label: 'Exceeds 7-Day Limit',
    description: 'Request exceeds the 7-day absence limit',
    selectLabel: '7+ days - Absence period exceeds 7 days',
  },
  {
    value: 'Duplicate',
    label: 'Duplicate Submission',
    description: 'Patient submitted the intake form twice',
    selectLabel: 'Duplicate - Patient submitted twice',
  },
  {
    value: 'Refund (Customer)',
    label: 'Refund (Customer)',
    description: 'Customer requested a refund',
    selectLabel: 'Refund (Customer)',
  },
  {
    value: 'Refund (Denial)',
    label: 'Refund (Denial)',
    description: 'Employer or school denied the note',
    selectLabel: 'Refund (Denial)',
  },
  {
    value: 'Under 18',
    label: 'Under 18',
    description: 'Patient is under 18 years old (minor using parent/guardian info)',
    selectLabel: 'Under 18 - Patient is a minor',
  },
  {
    value: 'Accommodations',
    label: 'Accommodations',
    description: 'Request is for workplace or school accommodations',
    selectLabel: 'Accommodations - Cannot provide accommodation requests',
  },
  {
    value: 'Other',
    label: 'Other Reason',
    description: 'Other reason for denial',
    selectLabel: 'Other',
  },
]

export const NOTE_PURPOSE_LABELS: Record<string, string> = {
  work: 'Work',
  school: 'School',
  both: 'Work & School',
  travel: 'Travel',
  other: 'Other',
}

export function formatNotePurpose(purpose: string): string {
  const purposes: Record<string, string> = {
    work: 'Work Excuse',
    school: 'School Excuse',
    both: 'Work & School Excuse',
    travel: 'Travel Excuse',
    other: 'Other',
  }
  return purposes[purpose] || purpose
}
