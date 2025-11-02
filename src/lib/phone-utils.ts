/**
 * Phone Formatting Utilities
 * Shared functions for handling phone number formatting
 */

/**
 * Formats a phone number string into (XXX) XXX-XXXX format
 * @param value - Raw phone number string (may contain non-numeric characters)
 * @returns Formatted phone number string
 */
export const formatPhoneNumber = (value: string): string => {
  // Remove all non-numeric characters
  const phoneNumber = value.replace(/\D/g, '')

  // Format based on length
  if (phoneNumber.length <= 3) {
    return phoneNumber
  }

  if (phoneNumber.length <= 6) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
  }

  // Full format with area code, prefix, and line number
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}
