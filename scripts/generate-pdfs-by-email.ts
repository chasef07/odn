import { disconnectDatabase } from '@/db/connection'
import { findApprovedSubmissionsForEmail, findSubmissionById } from '@/db/submissions'
import { generateDoctorNotePDF, generatePDFFilename } from '@/lib/pdf/generate-pdf'
import * as fs from 'fs'
import * as path from 'path'

interface GenerateResult {
  email: string
  submissionId: string
  patientName: string
  filename: string
  success: boolean
  error?: string
}

async function findApprovedSubmissions(email: string) {
  const submissions = await findApprovedSubmissionsForEmail(email.toLowerCase().trim())

  return submissions
}

async function generateAndSavePDF(submissionId: string, outputDir: string): Promise<string> {
  const submission = await findSubmissionById(submissionId)

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found`)
  }

  const pdfBuffer = await generateDoctorNotePDF(submission)
  const filename = generatePDFFilename(submission.id)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const filepath = path.join(outputDir, filename)
  fs.writeFileSync(filepath, pdfBuffer)

  return filename
}

async function main() {
  const args = process.argv.slice(2)

  const emails = args.filter((arg) => !arg.startsWith('--'))
  const outputDirIndex = args.indexOf('--output')
  const outputDir =
    outputDirIndex !== -1 && args[outputDirIndex + 1]
      ? args[outputDirIndex + 1]
      : './generated-pdfs'

  if (emails.length === 0) {
    console.error('❌ Error: Please provide at least one email address')
    console.log('\nUsage:')
    console.log('  npx tsx scripts/generate-pdfs-by-email.ts patient@example.com')
    console.log('  npx tsx scripts/generate-pdfs-by-email.ts email1@test.com email2@test.com')
    console.log(
      '  npx tsx scripts/generate-pdfs-by-email.ts patient@example.com --output ./my-pdfs'
    )
    process.exit(1)
  }

  console.log(`🔍 Searching for approved submissions for ${emails.length} email(s)...\n`)
  console.log(`📁 PDFs will be saved to: ${path.resolve(outputDir)}\n`)

  try {
    const allResults: GenerateResult[] = []

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

        console.log(`   ${index + 1}. ${patientName}`)
        console.log(`      Submission ID: ${submission.id}`)
        console.log(`      Approved on: ${reviewedDate}`)
        console.log(`      Note purpose: ${submission.notePurpose}`)
        console.log(`      State: ${submission.state}`)
        console.log('')

        allResults.push({
          email: submission.email,
          submissionId: submission.id,
          patientName,
          filename: generatePDFFilename(submission.id),
          success: false,
        })
      })
    }

    if (allResults.length === 0) {
      console.log('❌ No approved submissions found for the provided email addresses.')
      return
    }

    console.log('━'.repeat(60))
    console.log('📄 GENERATING PDFs...\n')

    let successful = 0
    let failed = 0

    for (const result of allResults) {
      try {
        console.log(`Generating PDF for ${result.patientName} (${result.email})...`)
        const filename = await generateAndSavePDF(result.submissionId, outputDir)
        result.success = true
        successful++
        console.log(`✅ Saved: ${filename}\n`)
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
    console.log(`Output directory: ${path.resolve(outputDir)}`)
    console.log(`Total PDFs processed: ${allResults.length}`)
    console.log(`✅ Successfully generated: ${successful}`)
    console.log(`❌ Failed: ${failed}`)

    if (successful > 0) {
      console.log('\n✅ Generated PDFs:')
      allResults
        .filter((r) => r.success)
        .forEach((result) => {
          console.log(`  - ${result.filename} (${result.patientName})`)
        })
    }

    if (failed > 0) {
      console.log('\n❌ Failed PDFs:')
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
