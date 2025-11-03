/**
 * Mock Submissions Data
 * Sample patient submissions for admin portal UI development
 */

export type SubmissionStatus = 'pending_review' | 'approved' | 'denied'

export interface Submission {
  id: string
  status: SubmissionStatus
  state: string
  recipient: 'myself' | 'someone_else'

  // Patient Information
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: string // ISO format

  // Guardian Information (if recipient = "someone_else")
  guardianFirstName?: string
  guardianLastName?: string
  guardianDateOfBirth?: string // ISO format

  // Contact Information
  email: string
  phone: string

  // Note Request
  notePurpose: 'work' | 'school' | 'both' | 'other'
  firstDayOff: string // ISO format
  lastDayOff: string // ISO format
  absenceReason: string
  symptoms: string[]
  additionalInformation: string | null

  // Metadata
  createdAt: string // ISO format
}

export const mockSubmissions: Submission[] = [
  // Submission 1: Simple work excuse (oldest)
  {
    id: 'mock-001',
    status: 'pending_review',
    state: 'California',
    recipient: 'myself',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: '1990-05-15',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    notePurpose: 'work',
    firstDayOff: '2025-11-01',
    lastDayOff: '2025-11-02',
    absenceReason: 'Flu symptoms',
    symptoms: ['Fever', 'Cough', 'Fatigue'],
    additionalInformation: null,
    createdAt: '2025-10-28T08:30:00Z',
  },

  // Submission 2: School excuse with guardian
  {
    id: 'mock-002',
    status: 'pending_review',
    state: 'Texas',
    recipient: 'someone_else',
    patientFirstName: 'Emily',
    patientLastName: 'Johnson',
    patientDateOfBirth: '2015-08-20',
    guardianFirstName: 'Sarah',
    guardianLastName: 'Johnson',
    guardianDateOfBirth: '1985-03-10',
    email: 'sarah.johnson@example.com',
    phone: '(555) 987-6543',
    notePurpose: 'school',
    firstDayOff: '2025-10-30',
    lastDayOff: '2025-11-01',
    absenceReason: 'Stomach bug',
    symptoms: ['Nausea', 'Vomiting', 'Stomach pain'],
    additionalInformation: 'Child needs to stay home for 5 days per school policy',
    createdAt: '2025-10-30T14:15:00Z',
  },

  // Submission 3: Both work & school (most recent)
  {
    id: 'mock-003',
    status: 'pending_review',
    state: 'New York',
    recipient: 'myself',
    patientFirstName: 'Michael',
    patientLastName: 'Chen',
    patientDateOfBirth: '1995-12-03',
    email: 'michael.chen@example.com',
    phone: '(555) 456-7890',
    notePurpose: 'both',
    firstDayOff: '2025-11-02',
    lastDayOff: '2025-11-03',
    absenceReason: 'Severe migraine',
    symptoms: ['Headache', 'Sensitivity to light', 'Nausea'],
    additionalInformation: 'Unable to work or attend classes due to severe symptoms',
    createdAt: '2025-11-02T10:00:00Z',
  },
]
