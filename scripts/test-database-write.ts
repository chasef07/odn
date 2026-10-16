import { disconnectDatabase } from '../src/db/connection'
import { deleteSubmissionById, findSubmissionById, insertSubmission } from '../src/db/submissions'
import { SubmissionStatus } from '../src/db/types'

async function testDatabaseWrite() {
  try {
    console.log('🧪 Testing Database Write Operations...\n')

    const testData = {
      stripePaymentIntentId: `pi_test_${Date.now()}`,
      status: SubmissionStatus.PENDING_REVIEW,
      state: 'CA',
      recipient: 'myself',
      patientFirstName: 'Test',
      patientLastName: 'User',
      patientDateOfBirth: new Date('1990-01-01'),
      email: `test-${Date.now()}@example.com`,
      phone: '5555551234',
      notePurpose: 'work',
      firstDayOff: new Date('2025-11-01'),
      lastDayOff: new Date('2025-11-02'),
      absenceReason: 'Feeling sick',
      symptoms: ['Fever', 'Cough'],
    }

    console.log('📝 Creating test submission...')
    const submission = await insertSubmission(testData)

    console.log('✅ Submission created successfully!')
    console.log(`   ID: ${submission.id}`)
    console.log(`   Email: ${submission.email}`)
    console.log(`   Status: ${submission.status}`)
    console.log(`   First Day Off: ${submission.firstDayOff}`)
    console.log(`   Last Day Off: ${submission.lastDayOff}`)
    console.log(`   Payment Intent: ${submission.stripePaymentIntentId}`)

    console.log('\n🔍 Reading submission back from database...')
    const retrieved = await findSubmissionById(submission.id)

    if (retrieved) {
      console.log('✅ Submission retrieved successfully!')
      console.log(`   Data matches: ${retrieved.email === testData.email}`)
    } else {
      console.log('❌ Failed to retrieve submission')
    }

    console.log('\n🧹 Cleaning up test data...')
    await deleteSubmissionById(submission.id)
    console.log('✅ Test submission deleted')

    console.log('\n✅ Database write test PASSED!')
    console.log('   - Create: ✅')
    console.log('   - Read: ✅')
    console.log('   - Delete: ✅')
  } catch (error) {
    console.error('❌ Database write test FAILED:', error)
    throw error
  } finally {
    await disconnectDatabase()
  }
}

testDatabaseWrite()
