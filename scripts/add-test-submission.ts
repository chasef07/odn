import prisma from '../src/lib/prisma'
import { SubmissionStatus } from '@prisma/client'

async function addTestSubmission() {
  try {
    console.log('🧪 Adding test submission to database...\n')

    const testSubmission = await prisma.submission.create({
      data: {
        stripePaymentIntentId: `pi_test_manual_${Date.now()}`,
        status: SubmissionStatus.PENDING_REVIEW,
        state: 'CA',
        recipient: 'myself',
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientDateOfBirth: new Date('1990-05-15'),
        email: 'john.doe@example.com',
        phone: '5551234567',
        notePurpose: 'work',
        firstDayOff: new Date('2025-11-10'),
        lastDayOff: new Date('2025-11-12'),
        absenceReason: 'Feeling sick',
        symptoms: ['Fever', 'Cough', 'Headache'],
        additionalInformation: 'This is a test submission for the admin portal',
      },
    })

    console.log('✅ Test submission created successfully!\n')
    console.log('Submission Details:')
    console.log(`  ID: ${testSubmission.id}`)
    console.log(`  Patient: ${testSubmission.patientFirstName} ${testSubmission.patientLastName}`)
    console.log(`  Email: ${testSubmission.email}`)
    console.log(`  Status: ${testSubmission.status}`)
    console.log(
      `  Dates: ${testSubmission.firstDayOff.toLocaleDateString()} - ${testSubmission.lastDayOff.toLocaleDateString()}`
    )
    console.log(`  Days Off: 3 days`)
    console.log(`  Payment Intent: ${testSubmission.stripePaymentIntentId}`)
    console.log(`\n📍 You can now test the admin portal at: http://localhost:3000/admin/review`)
  } catch (error) {
    console.error('❌ Failed to create test submission:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addTestSubmission()
