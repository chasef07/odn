/**
 * Age Validation Utilities
 * Reusable Zod validators for age-related validations
 */

import { z } from 'zod'
import { differenceInYears } from 'date-fns'

/**
 * Validates if a date string represents someone who is at least minAge years old
 * @param dateOfBirth - Date of birth string
 * @param minAge - Minimum age required (default: 18)
 * @returns true if age requirement is met
 */
export const isAgeValid = (dateOfBirth: string, minAge: number = 18): boolean => {
  return differenceInYears(new Date(), new Date(dateOfBirth)) >= minAge
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
