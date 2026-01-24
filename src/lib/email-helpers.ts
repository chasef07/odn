/**
 * Email Helper Functions
 * Centralized logic for email templates to ensure consistency
 */

/**
 * Get the appropriate recipient name based on note purpose
 * This determines "employer", "school", or "employer or school" in email text
 *
 * Note: Caregiver status does NOT affect this - only notePurpose matters
 * - Caregiver + Work → employer (adult taking care of family)
 * - Caregiver + School → school (student taking care of family)
 */
export function getRecipientName(notePurpose: string): string {
  if (notePurpose === 'work') return 'employer'
  if (notePurpose === 'school') return 'school'
  if (notePurpose === 'both') return 'employer or school'
  if (notePurpose === 'travel') return 'travel provider'

  return 'employer or school' // fallback for 'other'
}

/**
 * Get the "from X" text for email body
 * Maps note purpose to the appropriate absence location text
 *
 * Note: Caregiver status does NOT affect this - only notePurpose matters
 */
export function getAbsenceFromText(notePurpose: string): string {
  if (notePurpose === 'work') return 'from work'
  if (notePurpose === 'school') return 'from school'
  if (notePurpose === 'both') return 'from work and school'
  if (notePurpose === 'travel') return 'for travel'

  return '' // Generic case for 'other'
}

/**
 * Get the "from X / X-related activities" text for PDF body
 * Maps note purpose to the appropriate absence location text with activities suffix
 *
 * This is specifically for PDFs which use more formal language than emails.
 * Note: Caregiver status does NOT affect this - only notePurpose matters
 */
export function getPdfActivitiesText(notePurpose: string): string {
  if (notePurpose === 'work') return 'from work / work-related activities'
  if (notePurpose === 'school') return 'from school / school-related activities'
  if (notePurpose === 'both') return 'from work and school / work and school-related activities'
  if (notePurpose === 'travel') return 'for travel'

  return '' // Generic case for 'other' - no text appended
}
