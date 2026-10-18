import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'

export const BUSINESS_TIME_ZONE = 'America/New_York'

declare const dateOnlyBrand: unique symbol
declare const instantBrand: unique symbol

export type DateOnly = string & { readonly [dateOnlyBrand]: true }
export type Instant = Date & { readonly [instantBrand]: true }

export type DateOnlyStyle = 'long' | 'medium' | 'numeric' | 'short'
export type DateLocale = 'en' | 'es'

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 24 * 60 * 60 * 1000
const BUSINESS_DAY_START_HOUR = 6

const DATE_ONLY_FORMATS: Record<DateOnlyStyle, Record<DateLocale, string>> = {
  long: { en: 'MMMM d, yyyy', es: "d 'de' MMMM 'de' yyyy" },
  medium: { en: 'MMM d, yyyy', es: "d 'de' MMM 'de' yyyy" },
  numeric: { en: 'MM/dd/yyyy', es: 'MM/dd/yyyy' },
  short: { en: 'MM/dd/yy', es: 'MM/dd/yy' },
}

export function parseDateOnly(value: string): DateOnly | null {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return value as DateOnly
}

export function dateOnlyFromUtcDate(date: Date): DateOnly {
  return date.toISOString().slice(0, 10) as DateOnly
}

export function utcDateFromDateOnly(day: DateOnly): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

export function now(): Instant {
  return new Date() as Instant
}

export function instantOf(date: Date): Instant {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid instant')
  return date as Instant
}

function todayIn(timeZone: string, at: Instant): DateOnly {
  return formatInTimeZone(at, timeZone, 'yyyy-MM-dd') as DateOnly
}

export function todayET(at: Instant = now()): DateOnly {
  return todayIn(BUSINESS_TIME_ZONE, at)
}

export function todayUTC(at: Instant = now()): DateOnly {
  return dateOnlyFromUtcDate(at)
}

export function todayInViewerZone(at: Instant = now()): DateOnly {
  return todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone, at)
}

export function addDays(day: DateOnly, days: number): DateOnly {
  return dateOnlyFromUtcDate(new Date(utcDateFromDateOnly(day).getTime() + days * MS_PER_DAY))
}

export function inclusiveDayCount(first: DateOnly, last: DateOnly): number {
  const elapsed = utcDateFromDateOnly(last).getTime() - utcDateFromDateOnly(first).getTime()
  return elapsed / MS_PER_DAY + 1
}

export function ageOn(dateOfBirth: DateOnly, day: DateOnly): number {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number)
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  const hadBirthday = month > birthMonth || (month === birthMonth && dayOfMonth >= birthDay)
  return year - birthYear - (hadBirthday ? 0 : 1)
}

function formatUtc(day: DateOnly, pattern: string, locale: DateLocale = 'en'): string {
  return formatInTimeZone(utcDateFromDateOnly(day), 'UTC', pattern, {
    locale: locale === 'es' ? es : undefined,
  })
}

export function formatDateOnly(
  day: DateOnly,
  style: DateOnlyStyle = 'long',
  locale: DateLocale = 'en'
): string {
  return formatUtc(day, DATE_ONLY_FORMATS[style][locale], locale)
}

export function formatDateOnlyRange(first: DateOnly, last: DateOnly): string {
  if (first === last) return formatDateOnly(first, 'medium')
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${formatUtc(first, 'MMM d')}-${formatUtc(last, 'd, yyyy')}`
  }
  return `${formatUtc(first, 'MMM d')} - ${formatUtc(last, 'MMM d, yyyy')}`
}

export function formatInstantET(
  at: Instant,
  { includeYear = true }: { includeYear?: boolean } = {}
): string {
  return formatInTimeZone(
    at,
    BUSINESS_TIME_ZONE,
    includeYear ? 'MMM d, yyyy, h:mm a zzz' : 'MMM d, h:mm a zzz'
  )
}

export function businessDayStart(at: Instant = now()): Instant {
  const hour = Number(formatInTimeZone(at, BUSINESS_TIME_ZONE, 'H'))
  const today = todayET(at)
  const day = hour < BUSINESS_DAY_START_HOUR ? addDays(today, -1) : today
  return fromZonedTime(`${day}T06:00:00`, BUSINESS_TIME_ZONE) as Instant
}
