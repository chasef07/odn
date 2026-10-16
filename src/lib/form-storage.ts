import type { IntakeFields } from '@/lib/validation-schemas'

export type FormData = Partial<IntakeFields> & { offerCode?: string }

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
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to parse form data from storage, resetting:', error)
    }
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
