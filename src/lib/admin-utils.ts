/**
 * Admin Utility Functions
 * Helper functions for admin portal (date formatting, age calculation, etc.)
 */

import { formatDistanceToNow, format, differenceInDays, differenceInYears } from 'date-fns'

/**
 * Calculate age from date of birth
 * @param dob - Date of birth in ISO format (YYYY-MM-DD)
 * @returns Age in years
 */
export function calculateAge(dob: string): number {
  try {
    const birthDate = new Date(dob)
    const today = new Date()
    return differenceInYears(today, birthDate)
  } catch {
    return 0
  }
}

/**
 * Format a date range into human-readable format
 * @param start - Start date in ISO format
 * @param end - End date in ISO format
 * @returns Formatted date range (e.g., "Nov 1-2, 2025")
 */
export function formatDateRange(start: string, end: string): string {
  try {
    const startDate = new Date(start)
    const endDate = new Date(end)

    const startMonth = format(startDate, 'MMM')
    const startDay = format(startDate, 'd')
    const endDay = format(endDate, 'd')
    const year = format(endDate, 'yyyy')

    // Same day
    if (start === end) {
      return `${startMonth} ${startDay}, ${year}`
    }

    // Same month
    if (format(startDate, 'MMM yyyy') === format(endDate, 'MMM yyyy')) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`
    }

    // Different months
    const endMonth = format(endDate, 'MMM')
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
  } catch {
    return `${start} - ${end}`
  }
}

/**
 * Calculate number of days between two dates
 * @param start - Start date in ISO format
 * @param end - End date in ISO format
 * @returns Number of days (inclusive)
 */
export function calculateDaysDifference(start: string, end: string): number {
  try {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return differenceInDays(endDate, startDate) + 1 // +1 to make it inclusive
  } catch {
    return 0
  }
}

/**
 * Format a date into relative time (e.g., "5 mins ago")
 * @param date - Date in ISO format
 * @returns Relative time string
 */
export function formatRelativeTime(date: string): string {
  try {
    const dateObj = new Date(date)
    return formatDistanceToNow(dateObj, { addSuffix: true })
  } catch {
    return date
  }
}

/**
 * Format a date into full format (e.g., "November 1, 2025")
 * @param date - Date in ISO format
 * @returns Formatted date string
 */
export function formatFullDate(date: string): string {
  try {
    const dateObj = new Date(date)
    return format(dateObj, 'MMMM d, yyyy')
  } catch {
    return date
  }
}

/**
 * Format a date with time (e.g., "Nov 1, 2025 at 10:00 AM")
 * @param date - Date in ISO format
 * @returns Formatted date with time
 */
export function formatDateWithTime(date: string): string {
  try {
    const dateObj = new Date(date)
    return format(dateObj, "MMM d, yyyy 'at' h:mm a")
  } catch {
    return date
  }
}

/**
 * Capitalize first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalizeFirst(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Format note purpose for display
 * @param purpose - Note purpose value
 * @returns Human-readable purpose
 */
export function formatNotePurpose(purpose: string): string {
  const purposes: Record<string, string> = {
    work: 'Work Excuse',
    school: 'School Excuse',
    both: 'Work & School Excuse',
    other: 'Other',
  }
  return purposes[purpose] || purpose
}
