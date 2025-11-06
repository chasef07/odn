import prisma from '../src/lib/prisma'
import { SubmissionStatus } from '@prisma/client'

const newTestData = [
  {
    patientFirstName: 'Alice',
    patientLastName: 'Thompson',
    email: 'alice.thompson@example.com',
    patientDateOfBirth: new Date('1986-04-12'),
    state: 'CA',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-15'),
    lastDayOff: new Date('2025-11-17'),
    absenceReason: 'Severe migraine',
    symptoms: ['Headache', 'Nausea', 'Sensitivity to light'],
  },
  {
    patientFirstName: 'Brandon',
    patientLastName: 'Lee',
    email: 'brandon.lee@example.com',
    patientDateOfBirth: new Date('1991-08-22'),
    state: 'TX',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-14'),
    lastDayOff: new Date('2025-11-15'),
    absenceReason: 'Food poisoning',
    symptoms: ['Nausea', 'Vomiting', 'Diarrhea', 'Stomach pain'],
  },
  {
    patientFirstName: 'Catherine',
    patientLastName: 'Davis',
    email: 'catherine.davis@example.com',
    patientDateOfBirth: new Date('1989-12-05'),
    state: 'NY',
    notePurpose: 'school',
    firstDayOff: new Date('2025-11-16'),
    lastDayOff: new Date('2025-11-18'),
    absenceReason: 'Flu',
    symptoms: ['Fever', 'Cough', 'Body aches', 'Fatigue'],
  },
  {
    patientFirstName: 'Daniel',
    patientLastName: 'Martinez',
    email: 'daniel.martinez@example.com',
    patientDateOfBirth: new Date('1994-02-28'),
    state: 'FL',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-13'),
    lastDayOff: new Date('2025-11-14'),
    absenceReason: 'Sprained ankle',
    symptoms: ['Pain', 'Swelling', 'Limited mobility'],
  },
  {
    patientFirstName: 'Emma',
    patientLastName: 'Wilson',
    email: 'emma.wilson@example.com',
    patientDateOfBirth: new Date('1987-06-18'),
    state: 'WA',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-17'),
    lastDayOff: new Date('2025-11-19'),
    absenceReason: 'Bronchitis',
    symptoms: ['Cough', 'Chest pain', 'Shortness of breath'],
  },
  {
    patientFirstName: 'Frank',
    patientLastName: 'Garcia',
    email: 'frank.garcia@example.com',
    patientDateOfBirth: new Date('1992-10-09'),
    state: 'AZ',
    notePurpose: 'both',
    firstDayOff: new Date('2025-11-12'),
    lastDayOff: new Date('2025-11-13'),
    absenceReason: 'Dental surgery',
    symptoms: ['Pain', 'Swelling'],
  },
  {
    patientFirstName: 'Grace',
    patientLastName: 'Anderson',
    email: 'grace.anderson@example.com',
    patientDateOfBirth: new Date('1990-03-25'),
    state: 'GA',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-18'),
    lastDayOff: new Date('2025-11-20'),
    absenceReason: 'COVID-19',
    symptoms: ['Fever', 'Cough', 'Loss of taste', 'Fatigue'],
  },
  {
    patientFirstName: 'Henry',
    patientLastName: 'Brown',
    email: 'henry.brown@example.com',
    patientDateOfBirth: new Date('1988-07-14'),
    state: 'NC',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-11'),
    lastDayOff: new Date('2025-11-11'),
    absenceReason: 'Severe allergic reaction',
    symptoms: ['Rash', 'Swelling', 'Difficulty breathing'],
  },
  {
    patientFirstName: 'Isabella',
    patientLastName: 'Rodriguez',
    email: 'isabella.rodriguez@example.com',
    patientDateOfBirth: new Date('1995-01-30'),
    state: 'IL',
    notePurpose: 'school',
    firstDayOff: new Date('2025-11-19'),
    lastDayOff: new Date('2025-11-21'),
    absenceReason: 'Strep throat',
    symptoms: ['Sore throat', 'Fever', 'Difficulty swallowing'],
  },
  {
    patientFirstName: 'Jack',
    patientLastName: 'Miller',
    email: 'jack.miller@example.com',
    patientDateOfBirth: new Date('1993-11-11'),
    state: 'OH',
    notePurpose: 'work',
    firstDayOff: new Date('2025-11-10'),
    lastDayOff: new Date('2025-11-12'),
    absenceReason: 'Back injury',
    symptoms: ['Back pain', 'Muscle spasms', 'Limited mobility'],
  },
]

async function resetAndSeedSubmissions() {
  try {
    console.log('🧹 Clearing all submissions from database...\n')

    // Delete all submissions
    const deleteResult = await prisma.submission.deleteMany({})
    console.log(`✅ Deleted ${deleteResult.count} submissions\n`)

    console.log('🌱 Adding 10 new test submissions...\n')

    let count = 0
    for (const data of newTestData) {
      const submission = await prisma.submission.create({
        data: {
          stripePaymentIntentId: `pi_test_${Date.now()}_${count}`,
          status: SubmissionStatus.PENDING_REVIEW,
          recipient: 'myself',
          phone: '5551234567',
          ...data,
        },
      })

      count++
      const dayCount =
        Math.floor(
          (data.lastDayOff.getTime() - data.firstDayOff.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      console.log(
        `✅ ${count}. ${submission.patientFirstName} ${submission.patientLastName} - ${dayCount} day${dayCount > 1 ? 's' : ''}`
      )
    }

    console.log(`\n✅ Successfully added ${count} new test submissions!`)
    console.log(`📊 Total pending reviews: ${count}`)
    console.log(`📍 View at: http://localhost:3000/admin/review`)
  } catch (error) {
    console.error('❌ Failed to reset and seed submissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

resetAndSeedSubmissions()
