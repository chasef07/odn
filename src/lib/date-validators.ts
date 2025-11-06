/**
 * Date Validation Utilities
 * Shared functions for validating absence dates
 */

import { subDays, differenceInDays } from 'date-fns'
import { DATE_LIMITS } from './validation-constants'

export interface DatesFormData {
  firstDayOff: string
  lastDayOff: string
}

export interface DateValidationError {
  field: string
  message: string
}

/**
 * Validates absence date ranges according to business rules
 * - First day cannot be more than MAX_DAYS_IN_PAST days in the past
 * - Last day must be >= first day
 * - Last day cannot be more than MAX_ABSENCE_DAYS days from first day
 *
 * @param data - Form data containing date fields
 * @returns Array of validation errors (empty if valid)
 */
export const validateAbsenceDates = (data: DatesFormData): DateValidationError[] => {
  const errors: DateValidationError[] = []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstDay = new Date(data.firstDayOff)
  firstDay.setHours(0, 0, 0, 0)

  const lastDay = new Date(data.lastDayOff)
  lastDay.setHours(0, 0, 0, 0)

  // Check if first day is too far in the past
  const cutoffDate = subDays(today, DATE_LIMITS.MAX_DAYS_IN_PAST + 1)
  if (firstDay < cutoffDate) {
    errors.push({
      field: 'firstDayOff',
      message: `First day off cannot be more than ${DATE_LIMITS.MAX_DAYS_IN_PAST} days in the past`,
    })
  }

  // Check if last day is before first day
  if (lastDay < firstDay) {
    errors.push({
      field: 'lastDayOff',
      message: 'Last day off must be on or after first day off',
    })
  }

  // Check if absence period exceeds maximum allowed days
  const daysDifference = differenceInDays(lastDay, firstDay)
  if (daysDifference > DATE_LIMITS.MAX_ABSENCE_DAYS) {
    errors.push({
      field: 'lastDayOff',
      message: `Absence period cannot exceed ${DATE_LIMITS.MAX_ABSENCE_DAYS} days`,
    })
  }

  return errors
}
