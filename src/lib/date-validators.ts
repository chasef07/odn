import { subDays, differenceInDays } from 'date-fns'
import type { IntakeRule } from './intake-rules'
import { DATE_LIMITS } from './validation-constants'

export interface DatesFormData {
  firstDayOff: string
  lastDayOff: string
}

export interface DateValidationError {
  field: string
  message: string
  rule: IntakeRule
}

export const validateAbsenceDates = (data: DatesFormData): DateValidationError[] => {
  const errors: DateValidationError[] = []

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const firstDay = new Date(data.firstDayOff)
  firstDay.setUTCHours(0, 0, 0, 0)

  const lastDay = new Date(data.lastDayOff)
  lastDay.setUTCHours(0, 0, 0, 0)

  const cutoffDate = subDays(today, DATE_LIMITS.MAX_DAYS_IN_PAST + 1)
  if (firstDay < cutoffDate) {
    errors.push({
      field: 'firstDayOff',
      message: `First day off cannot be more than ${DATE_LIMITS.MAX_DAYS_IN_PAST} days in the past`,
      rule: 'absence_too_far_past',
    })
  }

  if (lastDay < firstDay) {
    errors.push({
      field: 'lastDayOff',
      message: 'Last day off must be on or after first day off',
      rule: 'absence_reversed',
    })
  }

  const daysDifference = differenceInDays(lastDay, firstDay)
  const totalDays = daysDifference + 1
  if (totalDays > DATE_LIMITS.MAX_ABSENCE_DAYS) {
    errors.push({
      field: 'lastDayOff',
      message: `Absence period cannot exceed ${DATE_LIMITS.MAX_ABSENCE_DAYS} consecutive days`,
      rule: 'absence_too_long',
    })
  }

  return errors
}
