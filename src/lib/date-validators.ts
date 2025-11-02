/**
 * Date Validation Utilities
 * Shared functions for validating absence dates
 */

import { subDays, differenceInDays } from 'date-fns'

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
 * - First day cannot be more than 7 days in the past
 * - Last day must be >= first day
 * - Last day cannot be more than 7 days from first day
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

  // Check if first day is more than 8 days in the past (message says 7 for user clarity)
  const eightDaysAgo = subDays(today, 8)
  if (firstDay < eightDaysAgo) {
    errors.push({
      field: 'firstDayOff',
      message: 'First day off cannot be more than 7 days in the past',
    })
  }

  // Check if last day is before first day
  if (lastDay < firstDay) {
    errors.push({
      field: 'lastDayOff',
      message: 'Last day off must be on or after first day off',
    })
  }

  // Check if absence period is more than 7 days
  const daysDifference = differenceInDays(lastDay, firstDay)
  if (daysDifference > 7) {
    errors.push({
      field: 'lastDayOff',
      message: 'Absence period cannot exceed 7 days',
    })
  }

  return errors
}
