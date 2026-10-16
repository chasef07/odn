import { disconnectDatabase } from '@/db/connection'
import {
  findApprovedSubmissionsForEmail,
  findSubmissionById,
  recordApprovalEmailSent,
} from '@/db/submissions'
import { sendApprovalEmail } from '@/lib/email'
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'

interface ResendResult {
  email: string
  submissionId: string
  patientName: string
  success: boolean
  error?: string
}

async function findApprovedSubmissions(email: string) {
  const submissions = await findApprovedSubmissionsForEmail(email.toLowerCase().trim())

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

  const emails = args.filter((arg) => !arg.startsWith('--'))
  const shouldSend = args.includes('--send')

  if (emails.length === 0) {
    console.error('❌ Error: Please provide at least one email address')
    console.log('\nUsage:')
    console.log('  npx tsx scripts/resend-approval-by-email.ts patient@example.com')
    console.log('  npx tsx scripts/resend-approval-by-email.ts patient@example.com --send')
    console.log(
      '  npx tsx scripts/resend-approval-by-email.ts email1@test.com email2@test.com --send'
    )
    process.exit(1)
  }

  console.log(`🔍 Searching for approved submissions for ${emails.length} email(s)...\n`)

  try {
    const allResults: ResendResult[] = []

    for (const email of emails) {
      console.log(`📧 Looking up: ${email}`)

      const submissions = await findApprovedSubmissions(email)

      if (submissions.length === 0) {
        console.log(`   ⚠️  No approved submissions found for ${email}\n`)
        continue
      }

      console.log(`   ✅ Found ${submissions.length} approved submission(s)\n`)

      submissions.forEach((submission, index) => {
        const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
        const reviewedDate = submission.reviewedAt?.toLocaleDateString() || 'Unknown'
        const emailSent = submission.approvalEmailSentAt ? '✅ Already sent' : '❌ Not sent'

        console.log(`   ${index + 1}. ${patientName}`)
        console.log(`      Submission ID: ${submission.id}`)
        console.log(`      Approved on: ${reviewedDate}`)
        console.log(`      Note purpose: ${submission.notePurpose}`)
        console.log(`      Email status: ${emailSent}`)
        if (submission.approvalEmailSentAt) {
          console.log(`      Sent at: ${submission.approvalEmailSentAt.toLocaleString()}`)
        }
        console.log('')
      })

      submissions.forEach((submission) => {
        allResults.push({
          email: submission.email,
          submissionId: submission.id,
          patientName: `${submission.patientFirstName} ${submission.patientLastName}`,
          success: false,
        })
      })
    }

    if (allResults.length === 0) {
      console.log('❌ No submissions found for the provided email addresses.')
      return
    }

    if (!shouldSend) {
      console.log('━'.repeat(60))
      console.log('ℹ️  DRY RUN MODE - No emails will be sent.')
      console.log('ℹ️  To actually send/resend these emails, add --send flag:')
      console.log(`   npx tsx scripts/resend-approval-by-email.ts ${emails.join(' ')} --send\n`)

      console.log(`📊 Summary: ${allResults.length} email(s) will be sent`)
      console.log('   Note: Emails already sent will be resent (with updated timestamp)')
      return
    }

    console.log('━'.repeat(60))
    console.log('📤 SENDING EMAILS...\n')

    let successful = 0
    let failed = 0

    for (const result of allResults) {
      try {
        console.log(`Sending to ${result.patientName} (${result.email})...`)
        await resendApprovalEmail(result.submissionId)
        result.success = true
        successful++
        console.log(`✅ Success!\n`)
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.error = errorMessage
        console.log(`❌ Failed: ${errorMessage}\n`)
      }
    }

    console.log('━'.repeat(60))
    console.log('📊 FINAL SUMMARY')
    console.log('━'.repeat(60))
    console.log(`Total emails processed: ${allResults.length}`)
    console.log(`✅ Successfully sent: ${successful}`)
    console.log(`❌ Failed: ${failed}`)

    if (failed > 0) {
      console.log('\n❌ Failed emails:')
      allResults
        .filter((r) => !r.success)
        .forEach((result) => {
          console.log(`  - ${result.patientName} (${result.email})`)
          console.log(`    Submission ID: ${result.submissionId}`)
          console.log(`    Error: ${result.error}`)
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
