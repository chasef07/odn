import { disconnectDatabase } from '../src/db/connection'
import {
  countSubmissions,
  countSubmissionsByStatus,
  findRecentSubmissions,
} from '../src/db/submissions'
import {
  countExpiredTemporarySubmissions,
  countTemporarySubmissions,
  findRecentTemporarySubmissions,
} from '../src/db/temporary-submissions'

async function inspectDatabase() {
  try {
    console.log('🔍 Inspecting Database...\n')

    const tempCount = await countTemporarySubmissions()
    const submissionCount = await countSubmissions()

    console.log('📊 Record Counts:')
    console.log(`  TemporarySubmissions: ${tempCount}`)
    console.log(`  Submissions (permanent): ${submissionCount}\n`)

    if (tempCount > 0) {
      console.log('📝 Recent Temporary Submissions:')
      const tempSubmissions = await findRecentTemporarySubmissions()
      console.table(tempSubmissions)
    }

    if (submissionCount > 0) {
      console.log('\n✅ Recent Permanent Submissions:')
      const submissions = await findRecentSubmissions()
      console.table(submissions)
    }

    const expiredCount = await countExpiredTemporarySubmissions(new Date())

    if (expiredCount > 0) {
      console.log(
        `\n⚠️  Found ${expiredCount} expired temporary submissions (should be cleaned up)`
      )
    }

    const statusBreakdown = await countSubmissionsByStatus()

    if (statusBreakdown.length > 0) {
      console.log('\n📈 Submissions by Status:')
      console.table(statusBreakdown)
    }

    console.log('\n✅ Database inspection complete!')
  } catch (error) {
    console.error('❌ Error inspecting database:', error)
  } finally {
    await disconnectDatabase()
  }
}

inspectDatabase()
