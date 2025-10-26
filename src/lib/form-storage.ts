/**
 * Form Storage Utilities
 * Handles localStorage persistence for form data
 */

export interface FormData {
  // Page 1
  recipient?: 'myself' | 'someone_else';
  relationship?: string;

  // Page 2
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // ISO format

  // Page 3
  email?: string;
  phone?: string;

  // Page 4
  state?: string;

  // Page 5
  notePurpose?: 'work' | 'school' | 'both' | 'other';

  // Page 6
  firstDayOff?: string; // ISO format
  lastDayOff?: string; // ISO format

  // Page 7
  absenceReason?: string;

  // Page 8
  symptoms?: string[];
  otherSymptomText?: string;
}

const FORM_STORAGE_KEY = 'doctor-note-form-draft';

export function saveFormData(data: Partial<FormData>): void {
  if (typeof window === 'undefined') return;

  const existing = getFormData();
  const updated = { ...existing, ...data };
  localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(updated));
}

export function getFormData(): FormData {
  if (typeof window === 'undefined') return {};

  const stored = localStorage.getItem(FORM_STORAGE_KEY);

  if (!stored) return {};

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Failed to parse form data from storage, resetting:', error);
    // Clear the corrupted data
    localStorage.removeItem(FORM_STORAGE_KEY);
    return {};
  }
}

export function clearFormData(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(FORM_STORAGE_KEY);
}

export function getFirstName(): string | null {
  const data = getFormData();
  return data.firstName || null;
}
