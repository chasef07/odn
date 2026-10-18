import { disconnectDatabase } from '../src/db/connection'
import { insertSubmission } from '../src/db/submissions'
import { SubmissionStatus } from '../src/db/types'

const testData = [
  {
    patientFirstName: 'Sarah',
    patientLastName: 'Johnson',
    email: 'sarah.johnson@example.com',
    patientDateOfBirth: new Date('1985-03-20'),
    state: 'NY',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-08'),
    lastDayOff: new Date('2025-11-09'),
    absenceReason: 'Flu symptoms',
    symptoms: ['Fever', 'Body aches'],
  },
  {
    patientFirstName: 'Michael',
    patientLastName: 'Chen',
    email: 'michael.chen@example.com',
    patientDateOfBirth: new Date('1992-07-12'),
    state: 'TX',
    notePurpose: 'school',
    firstDayOff: new Date('2025-11-11'),
    lastDayOff: new Date('2025-11-13'),
    absenceReason: 'COVID-19',
    symptoms: ['Cough', 'Fever', 'Fatigue'],
  },
  {
    patientFirstName: 'Emily',
    patientLastName: 'Rodriguez',
    email: 'emily.rodriguez@example.com',
    patientDateOfBirth: new Date('1988-11-05'),
    state: 'FL',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-07'),
    lastDayOff: new Date('2025-11-07'),
    absenceReason: 'Migraine',
    symptoms: ['Headache', 'Nausea'],
  },
  {
    patientFirstName: 'David',
    patientLastName: 'Williams',
    email: 'david.williams@example.com',
    patientDateOfBirth: new Date('1995-01-28'),
    state: 'CA',
    notePurpose: 'both',
    firstDayOff: new Date('2025-11-09'),
    lastDayOff: new Date('2025-11-11'),
    absenceReason: 'Stomach flu',
    symptoms: ['Nausea', 'Vomiting', 'Diarrhea'],
  },
  {
    patientFirstName: 'Jennifer',
    patientLastName: 'Martinez',
    email: 'jennifer.martinez@example.com',
    patientDateOfBirth: new Date('1990-06-15'),
    state: 'IL',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-12'),
    lastDayOff: new Date('2025-11-14'),
    absenceReason: 'Respiratory infection',
    symptoms: ['Cough', 'Sore throat', 'Congestion'],
  },
  {
    patientFirstName: 'Robert',
    patientLastName: 'Taylor',
    email: 'robert.taylor@example.com',
    patientDateOfBirth: new Date('1987-09-22'),
    state: 'WA',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-10'),
    lastDayOff: new Date('2025-11-12'),
    absenceReason: 'Back pain',
    symptoms: ['Back pain', 'Limited mobility'],
  },
  {
    patientFirstName: 'Amanda',
    patientLastName: 'Anderson',
    email: 'amanda.anderson@example.com',
    patientDateOfBirth: new Date('1993-04-18'),
    state: 'GA',
    notePurpose: 'school',
    firstDayOff: new Date('2025-11-13'),
    lastDayOff: new Date('2025-11-15'),
    absenceReason: 'Allergic reaction',
    symptoms: ['Rash', 'Itching', 'Swelling'],
  },
  {
    patientFirstName: 'Christopher',
    patientLastName: 'Thomas',
    email: 'chris.thomas@example.com',
    patientDateOfBirth: new Date('1991-12-03'),
    state: 'AZ',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-08'),
    lastDayOff: new Date('2025-11-10'),
    absenceReason: 'Dental emergency',
    symptoms: ['Tooth pain', 'Swelling'],
  },
  {
    patientFirstName: 'Jessica',
    patientLastName: 'Moore',
    email: 'jessica.moore@example.com',
    patientDateOfBirth: new Date('1989-08-25'),
    state: 'NC',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-14'),
    lastDayOff: new Date('2025-11-16'),
    absenceReason: 'Anxiety and stress',
    symptoms: ['Anxiety', 'Fatigue', 'Insomnia'],
  },
  {
    patientFirstName: 'Matthew',
    patientLastName: 'Jackson',
    email: 'matthew.jackson@example.com',
    patientDateOfBirth: new Date('1994-02-14'),
    state: 'OH',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-11'),
    lastDayOff: new Date('2025-11-12'),
    absenceReason: 'Injury',
    symptoms: ['Pain', 'Limited mobility'],
  },
]

async function addMultipleTestSubmissions() {
  try {
    console.log('🧪 Adding 10 test submissions to database...\n')

    let count = 0
    for (const data of testData) {
      const { submission } = await insertSubmission({
        stripePaymentIntentId: `pi_test_${Date.now()}_${count}`,
        status: SubmissionStatus.PENDING_REVIEW,
        recipient: 'myself',
        phone: '5551234567',
        ...data,
      })

      count++
      console.log(
        `✅ ${count}. Created: ${submission.patientFirstName} ${submission.patientLastName}`
      )
    }

    console.log(`\n✅ Successfully added ${count} test submissions!`)
    console.log(`\n📊 Total pending reviews in database: ${count + 1}`)
    console.log(`📍 View at: http://localhost:3000/admin/review`)
  } catch (error) {
    console.error('❌ Failed to create test submissions:', error)
    throw error
  } finally {
    await disconnectDatabase()
  }
}

addMultipleTestSubmissions()
