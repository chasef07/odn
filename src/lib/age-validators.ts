/**
 * Age Validation Utilities
 * Reusable Zod validators for age-related validations
 */

import { z } from 'zod'
import { differenceInYears } from 'date-fns'
import { isAtLeastAge, parseIsoDateOnly } from './date-only'

/**
 * Validates if a date string represents someone who is at least minAge years old
 * @param dateOfBirth - Date of birth string
 * @param minAge - Minimum age required (default: 18)
 * @returns true if age requirement is met
 */
export const isAgeValid = (dateOfBirth: string, minAge: number = 18): boolean => {
  if (parseIsoDateOnly(dateOfBirth)) {
    return isAtLeastAge(dateOfBirth, minAge)
  }

  const parsedDate = new Date(dateOfBirth)
  if (Number.isNaN(parsedDate.getTime())) return false

  return differenceInYears(new Date(), parsedDate) >= minAge
}

/**
 * Creates a Zod validator for minimum age requirement
 * @param minAge - Minimum age required (default: 18)
 * @param fieldName - Name of the field for error message (default: "You")
 * @returns Zod string schema with age validation
 */
export const createAgeValidator = (minAge: number = 18, fieldName: string = 'You') => {
  return z.string().refine((val) => isAgeValid(val, minAge), {
    message: `${fieldName} must be ${minAge} years or older`,
  })
}
