import { disconnectDatabase } from '@/db/connection'
import {
  findApprovedSubmissionsMissingApprovalEmail,
  findSubmissionById,
  recordApprovalEmailSent,
} from '@/db/submissions'
import { sendApprovalEmail } from '@/lib/email'
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'

interface ResendStats {
  total: number
  successful: number
  failed: number
  errors: Array<{ submissionId: string; email: string; error: string }>
}

async function findMissingApprovalEmails() {
  const submissions = await findApprovedSubmissionsMissingApprovalEmail()

  return submissions
}

async function resendApprovalEmail(submissionId: string): Promise<void> {
  const submission = await findSubmissionById(submissionId)

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found`)
  }

  const pdfBuffer = await generateDoctorNotePDF(submission)
  const pdfFilename = generatePDFFilename(submission.id)

  const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
  await sendApprovalEmail({
    to: submission.email,
    patientName,
    notePurpose: submission.notePurpose,
    absenceReason: submission.absenceReason,
    pdfBuffer,
    pdfFilename,
  })

  await recordApprovalEmailSent(submissionId, new Date())
}

async function main() {
  const args = process.argv.slice(2)
  const shouldSend = args.includes('--send')

  console.log('🔍 Searching for approved submissions missing approval emails...\n')

  try {
    const submissions = await findMissingApprovalEmails()

    if (submissions.length === 0) {
      console.log('✅ All approved submissions have received their approval emails!')
      return
    }

    console.log(`📧 Found ${submissions.length} submission(s) missing approval emails:\n`)

    submissions.forEach((submission, index) => {
      const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
      const reviewedDate = submission.reviewedAt?.toLocaleDateString() || 'Unknown'
      console.log(`${index + 1}. ${patientName} (${submission.email})`)
      console.log(`   Submission ID: ${submission.id}`)
      console.log(`   Approved on: ${reviewedDate}`)
      console.log(`   Note purpose: ${submission.notePurpose}`)
      console.log('')
    })

    if (!shouldSend) {
      console.log('ℹ️  DRY RUN MODE - No emails will be sent.')
      console.log('ℹ️  To actually send these emails, run:')
      console.log('   npx tsx scripts/resend-approval-emails.ts --send\n')
      return
    }

    console.log('📤 Sending approval emails...\n')

    const stats: ResendStats = {
      total: submissions.length,
      successful: 0,
      failed: 0,
      errors: [],
    }

    for (const submission of submissions) {
      const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
      try {
        console.log(`Sending to ${patientName} (${submission.email})...`)
        await resendApprovalEmail(submission.id)
        stats.successful++
        console.log(`✅ Success!\n`)
      } catch (error) {
        stats.failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.log(`❌ Failed: ${errorMessage}\n`)
        stats.errors.push({
          submissionId: submission.id,
          email: submission.email,
          error: errorMessage,
        })
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total submissions: ${stats.total}`)
    console.log(`✅ Successfully sent: ${stats.successful}`)
    console.log(`❌ Failed: ${stats.failed}`)

    if (stats.errors.length > 0) {
      console.log('\n❌ Failed submissions:')
      stats.errors.forEach((error) => {
        console.log(`  - ${error.submissionId} (${error.email}): ${error.error}`)
      })
    }

    console.log('')
  } catch (error) {
    console.error('❌ Script failed:', error)
    throw error
  } finally {
    await disconnectDatabase()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
