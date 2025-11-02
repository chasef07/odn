/**
 * Validation Constants
 * Magic numbers and configuration values for form validation
 */

// Character limits for text fields
export const CHAR_LIMITS = {
  NAME: 50,
  OTHER_PURPOSE: 500,
  OTHER_ABSENCE_REASON: 200,
  OTHER_SYMPTOM: 500,
  ADDITIONAL_INFO: 1000,
} as const

// Date validation constants
export const DATE_LIMITS = {
  MIN_YEAR: 1900,
  MAX_DAYS_IN_PAST: 5,
  MAX_ABSENCE_DAYS: 14,
} as const

// Age validation constants
export const AGE_LIMITS = {
  MINIMUM_AGE: 18,
} as const

// Phone validation constants
export const PHONE_VALIDATION = {
  REQUIRED_DIGITS: 10,
  FORMATTED_LENGTH: 14, // (XXX) XXX-XXXX
} as const

// UI timing constants
export const UI_TIMING = {
  PROCESSING_DELAY_MS: 1500,
} as const
