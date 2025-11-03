import prisma from '../src/lib/prisma'

async function inspectSubmissionDetail() {
  try {
    console.log('🔍 Fetching detailed submission data...\n')

    const submission = await prisma.submission.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    if (!submission) {
      console.log('No submissions found')
      return
    }

    console.log('📋 SUBMISSION DETAILS:\n')
    console.log('=== Basic Info ===')
    console.log(`ID: ${submission.id}`)
    console.log(`Status: ${submission.status}`)
    console.log(`Created: ${submission.createdAt}`)
    console.log(`Email: ${submission.email}`)

    console.log('\n=== Patient Info ===')
    console.log(`Name: ${submission.patientFirstName} ${submission.patientLastName}`)
    console.log(`DOB: ${submission.patientDateOfBirth}`)
    console.log(`Phone: ${submission.phone}`)
    console.log(`State: ${submission.state}`)

    console.log('\n=== Guardian Info ===')
    console.log(`Guardian First Name: ${submission.guardianFirstName || 'N/A'}`)
    console.log(`Guardian Last Name: ${submission.guardianLastName || 'N/A'}`)
    console.log(`Guardian DOB: ${submission.guardianDateOfBirth || 'N/A'}`)

    console.log('\n=== Note Details ===')
    console.log(`Recipient: ${submission.recipient}`)
    console.log(`Purpose: ${submission.notePurpose}`)
    console.log(`First Day Off: ${submission.firstDayOff}`)
    console.log(`Last Day Off: ${submission.lastDayOff}`)
    console.log(`Absence Reason: ${submission.absenceReason}`)
    console.log(`Symptoms: ${submission.symptoms}`)
    console.log(`Additional Info: ${submission.additionalInformation || 'N/A'}`)

    console.log('\n=== Admin/Tracking ===')
    console.log(`Payment Intent ID: ${submission.stripePaymentIntentId}`)
    console.log(`Reviewed At: ${submission.reviewedAt || 'N/A'}`)
    console.log(`Reviewed By Admin ID: ${submission.reviewedByAdminId || 'N/A'}`)

    console.log('\n✅ Inspection complete!')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

inspectSubmissionDetail()
