export const DATE_LIMITS = {
  MIN_YEAR: 1900,
  MAX_DAYS_IN_PAST: 7,
  MAX_ABSENCE_DAYS: 7,
} as const

export const PHONE_VALIDATION = {
  REQUIRED_DIGITS: 10,
  FORMATTED_LENGTH: 14,
} as const

export const UI_TIMING = {
  PROCESSING_DELAY_MS: 1500,
} as const
