/**
 * Resend Approval Emails by Email Address
 *
 * This script resends approval emails for specific patient email addresses.
 * Useful when you know which patients were affected by the Cloudflare outage.
 *
 * Usage:
 *   - Dry run: npx tsx scripts/resend-approval-by-email.ts patient@example.com
 *   - Send: npx tsx scripts/resend-approval-by-email.ts patient@example.com --send
 *   - Multiple emails: npx tsx scripts/resend-approval-by-email.ts email1@test.com email2@test.com --send
 */

import { PrismaClient } from '@prisma/client'
import { sendApprovalEmail } from '@/lib/email'
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'

// Use direct DATABASE_URL instead of Prisma Accelerate for scripts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

interface ResendResult {
  email: string
  submissionId: string
  patientName: string
  success: boolean
  error?: string
}

/**
 * Find approved submissions for a specific email
 */
async function findApprovedSubmissions(email: string) {
  const submissions = await prisma.submission.findMany({
    where: {
      email: email.toLowerCase().trim(),
      status: 'APPROVED',
    },
    orderBy: {
      reviewedAt: 'desc',
    },
  })

  return submissions
}

/**
 * Resend approval email with PDF attachment
 */
async function resendApprovalEmail(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  })

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found`)
  }

  // Generate PDF
  const pdfBuffer = await generateDoctorNotePDF(submission)
  const pdfFilename = generatePDFFilename(submission.id)

  // Send email
  const patientName = `${submission.patientFirstName} ${submission.patientLastName}`
  await sendApprovalEmail({
    to: submission.email,
    patientName,
    notePurpose: submission.notePurpose,
    absenceReason: submission.absenceReason,
    pdfBuffer,
    pdfFilename,
  })

  // Update database to mark email as sent
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      approvalEmailSentAt: new Date(),
    },
  })
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)

  // Separate emails from flags
  const emails = args.filter(arg => !arg.startsWith('--'))
  const shouldSend = args.includes('--send')

  if (emails.length === 0) {
    console.error('❌ Error: Please provide at least one email address')
    console.log('\nUsage:')
    console.log('  npx tsx scripts/resend-approval-by-email.ts patient@example.com')
    console.log('  npx tsx scripts/resend-approval-by-email.ts patient@example.com --send')
    console.log('  npx tsx scripts/resend-approval-by-email.ts email1@test.com email2@test.com --send')
    process.exit(1)
  }

  console.log(`🔍 Searching for approved submissions for ${emails.length} email(s)...\n`)

  try {
    const allResults: ResendResult[] = []

    // Process each email
    for (const email of emails) {
      console.log(`📧 Looking up: ${email}`)

      const submissions = await findApprovedSubmissions(email)

      if (submissions.length === 0) {
        console.log(`   ⚠️  No approved submissions found for ${email}\n`)
        continue
      }

      console.log(`   ✅ Found ${submissions.length} approved submission(s)\n`)

      // Display each submission
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

      // Add to results for potential sending
      submissions.forEach(submission => {
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

      // Show what will happen
      const alreadySent = allResults.filter(r => {
        const sub = prisma.submission.findUnique({ where: { id: r.submissionId }})
        return false // simplified for dry run
      })
      console.log(`📊 Summary: ${allResults.length} email(s) will be sent`)
      console.log('   Note: Emails already sent will be resent (with updated timestamp)')
      return
    }

    // Actually send emails
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

    // Print summary
    console.log('━'.repeat(60))
    console.log('📊 FINAL SUMMARY')
    console.log('━'.repeat(60))
    console.log(`Total emails processed: ${allResults.length}`)
    console.log(`✅ Successfully sent: ${successful}`)
    console.log(`❌ Failed: ${failed}`)

    if (failed > 0) {
      console.log('\n❌ Failed emails:')
      allResults.filter(r => !r.success).forEach((result) => {
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
    await prisma.$disconnect()
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
