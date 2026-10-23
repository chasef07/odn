import { addDays, inclusiveDayCount, parseDateOnly, todayUTC } from './dates'
import type { IntakeRule } from './intake-rules'
import { DATE_LIMITS } from './validation-constants'

const US_ZONE_GRACE_DAYS = 1

export const ABSENCE_REVERSED_MESSAGE = 'Last day off must be on or after first day off'

export interface DatesFormData {
  firstDayOff: string
  lastDayOff: string
}

export interface DateValidationError {
  field: string
  message: string
  rule: IntakeRule
}

function invalidDay(field: keyof DatesFormData): DateValidationError {
  return { field, message: 'Expected a YYYY-MM-DD date', rule: 'date_invalid' }
}

export const validateAbsenceDates = (data: DatesFormData): DateValidationError[] => {
  const firstDayOff = parseDateOnly(data.firstDayOff)
  const lastDayOff = parseDateOnly(data.lastDayOff)
  if (!firstDayOff || !lastDayOff) {
    return [
      ...(firstDayOff ? [] : [invalidDay('firstDayOff')]),
      ...(lastDayOff ? [] : [invalidDay('lastDayOff')]),
    ]
  }

  const errors: DateValidationError[] = []
  const oldestFirstDay = addDays(todayUTC(), -(DATE_LIMITS.MAX_DAYS_IN_PAST + US_ZONE_GRACE_DAYS))

  if (firstDayOff < oldestFirstDay) {
    errors.push({
      field: 'firstDayOff',
      message: `First day off cannot be more than ${DATE_LIMITS.MAX_DAYS_IN_PAST} days in the past`,
      rule: 'absence_too_far_past',
    })
  }

  if (lastDayOff < firstDayOff) {
    errors.push({
      field: 'lastDayOff',
      message: ABSENCE_REVERSED_MESSAGE,
      rule: 'absence_reversed',
    })
  }

  if (inclusiveDayCount(firstDayOff, lastDayOff) > DATE_LIMITS.MAX_ABSENCE_DAYS) {
    errors.push({
      field: 'lastDayOff',
      message: `Absence period cannot exceed ${DATE_LIMITS.MAX_ABSENCE_DAYS} consecutive days`,
      rule: 'absence_too_long',
    })
  }

  return errors
}
