/**
 * Form Storage Utilities
 * Handles localStorage persistence for form data
 */

export interface FormData {
  // Get Started - State Selection
  state?: string

  // Page 1 - Who is this for?
  recipient?: 'myself' | 'someone_else' | null

  // Page 2 - Patient Information
  patientFirstName?: string
  patientLastName?: string
  patientDateOfBirth?: string // ISO format

  // Page 3 (Guardian Info - conditional)
  guardianFirstName?: string
  guardianLastName?: string
  guardianDateOfBirth?: string // ISO format

  // Page 4 - Contact Information
  email?: string
  phone?: string

  // Page 5 - Note Purpose
  notePurpose?: 'work' | 'school' | 'both' | 'other' | null
  otherNotePurpose?: string

  // Page 6 - Absence Dates
  firstDayOff?: string // ISO format
  lastDayOff?: string // ISO format

  // Page 7 - Absence Reason
  absenceReason?: string | null
  otherAbsenceReason?: string

  // Page 8 - Symptoms (conditional)
  symptoms?: string[]
  otherSymptomText?: string

  // Page 9 - Additional Information
  additionalInformation?: string

  // Page 10 - Review & Terms
  certifyAccurate?: boolean
  agreeTerms?: boolean
}

const FORM_STORAGE_KEY = 'doctor-note-form-draft'

export function saveFormData(data: Partial<FormData>): void {
  if (typeof window === 'undefined') return

  const existing = getFormData()
  const updated = { ...existing, ...data }
  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(updated))
}

export function getFormData(): FormData {
  if (typeof window === 'undefined') return {}

  const stored = localStorage.getItem(FORM_STORAGE_KEY)

  if (!stored) return {}

  try {
    return JSON.parse(stored)
  } catch (error) {
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to parse form data from storage, resetting:', error)
    }
    // Clear the corrupted data
    localStorage.removeItem(FORM_STORAGE_KEY)
    return {}
  }
}

export function clearFormData(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem(FORM_STORAGE_KEY)
}

export function getFirstName(): string | null {
  const data = getFormData()
  return data.patientFirstName || data.guardianFirstName || null
}
