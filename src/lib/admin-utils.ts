/**
 * Admin Utility Functions
 * Helper functions for admin portal (date formatting, age calculation, etc.)
 */

import { formatDistanceToNow, format, differenceInDays, differenceInYears, parse } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

/**
 * Denial reason types for submissions
 */
export type DenialReason = 'Legal' | '7+ days' | 'Other'

/**
 * Parse date string in local timezone to avoid off-by-one day issues
 * Handles both "yyyy-MM-dd" format and Date objects
 * @param date - Date string in "yyyy-MM-dd" format or Date object
 * @returns Date object in local timezone
 */
function parseLocalDate(date: string | Date): Date {
  if (date instanceof Date) {
    return date
  }

  // If it's an ISO string with time (from database), use regular Date constructor
  if (date.includes('T')) {
    return new Date(date)
  }

  // For "yyyy-MM-dd" format, parse in local timezone using date-fns
  return parse(date, 'yyyy-MM-dd', new Date())
}

/**
 * Calculate age from date of birth
 * @param dob - Date of birth (Date object or ISO string)
 * @returns Age in years
 */
export function calculateAge(dob: string | Date): number {
  try {
    const birthDate = parseLocalDate(dob)
    const today = new Date()
    return differenceInYears(today, birthDate)
  } catch {
    return 0
  }
}

/**
 * Format a date range into human-readable format
 * Uses UTC to avoid timezone shifts for calendar dates
 * @param start - Start date (Date object or ISO string)
 * @param end - End date (Date object or ISO string)
 * @returns Formatted date range (e.g., "Nov 1-2, 2025")
 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  try {
    const startDate = parseLocalDate(start)
    const endDate = parseLocalDate(end)

    const startMonth = formatInTimeZone(startDate, 'UTC', 'MMM')
    const startDay = formatInTimeZone(startDate, 'UTC', 'd')
    const endDay = formatInTimeZone(endDate, 'UTC', 'd')
    const year = formatInTimeZone(endDate, 'UTC', 'yyyy')

    // Same day
    if (startDate.getTime() === endDate.getTime()) {
      return `${startMonth} ${startDay}, ${year}`
    }

    // Same month
    if (formatInTimeZone(startDate, 'UTC', 'MMM yyyy') === formatInTimeZone(endDate, 'UTC', 'MMM yyyy')) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`
    }

    // Different months
    const endMonth = formatInTimeZone(endDate, 'UTC', 'MMM')
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
export function calculateDaysDifference(start: string | Date, end: string | Date): number {
  try {
    const startDate = parseLocalDate(start)
    const endDate = parseLocalDate(end)
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
export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return formatDistanceToNow(dateObj, { addSuffix: true })
  } catch {
    return typeof date === 'string' ? date : date.toISOString()
  }
}

/**
 * Format a date into full format (e.g., "November 1, 2025")
 * Uses UTC to avoid timezone shifts for calendar dates
 * @param date - Date in ISO format
 * @returns Formatted date string
 */
export function formatFullDate(date: string | Date): string {
  try {
    const dateObj = parseLocalDate(date)
    return formatInTimeZone(dateObj, 'UTC', 'MMMM d, yyyy')
  } catch {
    return typeof date === 'string' ? date : date.toISOString()
  }
}

/**
 * Format a date with time in Eastern Time (e.g., "Nov 1, 2025 at 10:00 AM ET")
 * Admin portal always displays times in America/New_York timezone
 * @param date - Date in ISO format
 * @returns Formatted date with time in Eastern Time
 */
export function formatDateWithTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return formatInTimeZone(dateObj, 'America/New_York', "MMM d, yyyy 'at' h:mm a")
  } catch {
    return typeof date === 'string' ? date : date.toISOString()
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
