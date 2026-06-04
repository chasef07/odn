/**
 * Manual Testing Script for Approval Flow
 * Generates a sample doctor's note PDF locally for visual inspection
 *
 * Usage:
 *   npx tsx scripts/test-approval-flow.ts
 *
 * This script will:
 * 1. Create a mock submission with realistic data
 * 2. Generate a PDF using the approval automation
 * 3. Save the PDF to ./test-output/sample-doctors-note.pdf
 * 4. Log the path for easy opening
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { Submission, SubmissionStatus } from '@prisma/client'
import { generateDoctorNotePDF } from '../src/lib/pdf/generate-pdf'
import fs from 'fs'
import path from 'path'

// Load .env.local file with override to ensure it takes precedence
config({ path: '.env.local', override: true })

// Sample submission data for testing
const mockSubmission: Submission = {
  id: 'test_submission_123',
  stripePaymentIntentId: 'pi_test_123',
  paymentAmount: 2495,
  offerCode: null,
  offerPriceId: null,
  status: SubmissionStatus.PENDING_REVIEW,
  state: 'California',
  recipient: 'myself',
  patientFirstName: 'John',
  patientLastName: 'Doe',
  patientDateOfBirth: new Date('1990-05-15'),
  guardianFirstName: null,
  guardianLastName: null,
  guardianDateOfBirth: null,
  email: 'john.doe@example.com',
  phone: '(555) 123-4567',
  smsOptIn: true,
  notePurpose: 'work',
  otherNotePurpose: null,
  firstDayOff: new Date('2024-11-08'),
  lastDayOff: new Date('2024-11-10'),
  absenceReason: 'illness',
  otherAbsenceReason: null,
  symptoms: ['Fever', 'Cough', 'Fatigue', 'Body Aches'],
  otherSymptomText: 'Severe headache and chills',
  additionalInformation:
    'Patient presented with flu-like symptoms. Advised to rest and stay hydrated. Return to work/school when fever-free for 24 hours without medication.',
  reviewedAt: null,
  reviewedByAdminId: null,
  denialReason: null,
  maybeReason: null,
  maybeInternalNote: null,
  maybeApprovedDays: null,
  maybeEmailSentAt: null,
  stripeRefundId: null,
  refundedAt: null,
  approvalEmailSentAt: null,
  denialEmailSentAt: null,
  createdAt: new Date('2024-11-07'),
  updatedAt: new Date('2024-11-07'),
}

// Sample submission with guardian (minor)
const mockSubmissionMinor: Submission = {
  ...mockSubmission,
  id: 'test_submission_minor_456',
  recipient: 'someone_else',
  patientFirstName: 'Emma',
  patientLastName: 'Smith',
  patientDateOfBirth: new Date('2010-03-20'),
  guardianFirstName: 'Sarah',
  guardianLastName: 'Smith',
  guardianDateOfBirth: new Date('1985-08-12'),
  notePurpose: 'school',
  email: 'sarah.smith@example.com',
}

async function main() {
  console.log('🧪 Testing Approval Flow - PDF Generation\n')

  // Check environment variables
  console.log('📋 Checking environment variables...')
  const requiredEnvVars = ['DOCTOR_NAME', 'DOCTOR_CREDENTIALS', 'DOCTOR_SIGNATURE_URL']

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:')
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`)
    })
    console.error('\nPlease add these to your .env.local file.')
    console.error('See .env.example for reference.\n')
    process.exit(1)
  }

  console.log('✅ All environment variables found')
  console.log('ℹ️  Using state-specific medical licenses from src/lib/state-licenses.ts\n')

  // Create output directory
  const outputDir = path.join(process.cwd(), 'test-output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
    console.log(`📁 Created output directory: ${outputDir}\n`)
  }

  try {
    // Test 1: Generate PDF for adult patient (work)
    console.log('📄 Test 1: Generating PDF for adult patient (work absence)...')
    const pdfBuffer1 = await generateDoctorNotePDF(mockSubmission)
    const outputPath1 = path.join(outputDir, 'sample-doctors-note-adult.pdf')
    fs.writeFileSync(outputPath1, pdfBuffer1)
    console.log(`✅ PDF generated successfully: ${outputPath1}\n`)

    // Test 2: Generate PDF for minor with guardian (school)
    console.log('📄 Test 2: Generating PDF for minor with guardian (school absence)...')
    const pdfBuffer2 = await generateDoctorNotePDF(mockSubmissionMinor)
    const outputPath2 = path.join(outputDir, 'sample-doctors-note-minor.pdf')
    fs.writeFileSync(outputPath2, pdfBuffer2)
    console.log(`✅ PDF generated successfully: ${outputPath2}\n`)

    // Summary
    console.log('='.repeat(60))
    console.log('✅ All tests passed!\n')
    console.log('Generated PDFs:')
    console.log(`   1. ${outputPath1}`)
    console.log(`   2. ${outputPath2}\n`)
    console.log('Open these files to visually inspect the PDF formatting.\n')
    console.log('Doctor Information Used:')
    console.log(`   Name: ${process.env.DOCTOR_NAME}`)
    console.log(`   Credentials: ${process.env.DOCTOR_CREDENTIALS}`)
    console.log(`   Signature: ${process.env.DOCTOR_SIGNATURE_URL}`)
    console.log(`   License: State-specific (from state-licenses.ts)`)
    console.log('='.repeat(60))
  } catch (error) {
    console.error('\n❌ Error generating PDF:')
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`)

      // Provide helpful hints based on error
      if (error.message.includes('signature')) {
        console.error('💡 Tip: Make sure your doctor signature image exists at:')
        console.error(`   ${process.env.DOCTOR_SIGNATURE_URL}\n`)
        console.error('   If using a relative path (e.g., /images/doctor-signature.png),')
        console.error('   the file should be at: public/images/doctor-signature.png\n')
      }

      if (error.message.includes('environment variables')) {
        console.error('💡 Tip: Check your .env.local file and ensure all doctor')
        console.error('   environment variables are set correctly.\n')
      }
    } else {
      console.error('   Unknown error occurred')
    }
    process.exit(1)
  }
}

// Run the script
main()
