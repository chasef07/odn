import { format, differenceInDays, differenceInYears, parse } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

export const ADMIN_TIME_ZONE = 'America/New_York'

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

function parseLocalDate(date: string | Date): Date {
  if (date instanceof Date) {
    return date
  }

  if (date.includes('T')) {
    return new Date(date)
  }

  return parse(date, 'yyyy-MM-dd', new Date())
}

export function calculateAge(dob: string | Date): number {
  try {
    const birthDate = parseLocalDate(dob)
    const today = new Date()
    return differenceInYears(today, birthDate)
  } catch {
    return 0
  }
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  try {
    const startDate = parseLocalDate(start)
    const endDate = parseLocalDate(end)

    const startMonth = formatInTimeZone(startDate, 'UTC', 'MMM')
    const startDay = formatInTimeZone(startDate, 'UTC', 'd')
    const endDay = formatInTimeZone(endDate, 'UTC', 'd')
    const year = formatInTimeZone(endDate, 'UTC', 'yyyy')

    if (startDate.getTime() === endDate.getTime()) {
      return `${startMonth} ${startDay}, ${year}`
    }

    if (
      formatInTimeZone(startDate, 'UTC', 'MMM yyyy') ===
      formatInTimeZone(endDate, 'UTC', 'MMM yyyy')
    ) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`
    }

    const endMonth = formatInTimeZone(endDate, 'UTC', 'MMM')
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
  } catch {
    return `${start} - ${end}`
  }
}

export function calculateDaysDifference(start: string | Date, end: string | Date): number {
  try {
    const startDate = parseLocalDate(start)
    const endDate = parseLocalDate(end)
    return differenceInDays(endDate, startDate) + 1
  } catch {
    return 0
  }
}

export function formatFullDate(date: string | Date): string {
  try {
    const dateObj = parseLocalDate(date)
    return formatInTimeZone(dateObj, 'UTC', 'MMMM d, yyyy')
  } catch {
    return typeof date === 'string' ? date : date.toISOString()
  }
}

export function formatDateWithTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return formatInTimeZone(dateObj, ADMIN_TIME_ZONE, "MMM d, yyyy 'at' h:mm a")
  } catch {
    return typeof date === 'string' ? date : date.toISOString()
  }
}

export function formatDateTimeET(
  date: string | Date,
  { includeYear = true }: { includeYear?: boolean } = {}
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(
    dateObj,
    ADMIN_TIME_ZONE,
    includeYear ? 'MMM d, yyyy, h:mm a zzz' : 'MMM d, h:mm a zzz'
  )
}

export function getTodayET(): string {
  return formatInTimeZone(new Date(), ADMIN_TIME_ZONE, 'yyyy-MM-dd')
}

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

export function getBusinessDayStart(): Date {
  const nowET = toZonedTime(new Date(), ADMIN_TIME_ZONE)

  if (nowET.getHours() < 6) {
    nowET.setDate(nowET.getDate() - 1)
  }

  const day = format(nowET, 'yyyy-MM-dd')
  return fromZonedTime(`${day}T06:00:00`, ADMIN_TIME_ZONE)
}
