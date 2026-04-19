export interface DateOnlyParts {
  year: number
  month: number
  day: number
}

const ISO_DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

export function getUTCDateOnlyParts(now: Date): DateOnlyParts {
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  }
}

export function compareDateOnly(a: DateOnlyParts, b: DateOnlyParts): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

export function parseIsoDateOnly(value: string): DateOnlyParts | null {
  const match = ISO_DATE_ONLY_REGEX.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day))
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

export function parseIsoDateOnlyAsUTCDate(value: string): Date | null {
  const parsed = parseIsoDateOnly(value)
  if (!parsed) return null

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
}

export function isIsoDateOnlyInSaneRange(
  value: string,
  { minYear = 1900, now = new Date() }: { minYear?: number; now?: Date } = {}
): boolean {
  const parsed = parseIsoDateOnly(value)
  if (!parsed) return false

  const minimum: DateOnlyParts = { year: minYear, month: 1, day: 1 }
  const today = getUTCDateOnlyParts(now)

  return compareDateOnly(parsed, minimum) >= 0 && compareDateOnly(parsed, today) <= 0
}

export function isAtLeastAge(
  dateOfBirth: string,
  minAge: number = 18,
  now: Date = new Date()
): boolean {
  const parsed = parseIsoDateOnly(dateOfBirth)
  if (!parsed) return false

  const today = getUTCDateOnlyParts(now)
  let age = today.year - parsed.year

  if (today.month < parsed.month || (today.month === parsed.month && today.day < parsed.day)) {
    age -= 1
  }

  return age >= minAge
}
