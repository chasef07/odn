/**
 * Test script to verify Resend API connection
 * Run with: npx tsx scripts/test-resend-connection.ts
 */

import { Resend } from 'resend'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL

console.log('🔍 Checking Resend Configuration...\n')

// Check if environment variables are set
if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not set in .env.local')
  process.exit(1)
}

if (!RESEND_FROM_EMAIL) {
  console.error('❌ RESEND_FROM_EMAIL is not set in .env.local')
  process.exit(1)
}

console.log('✅ Environment variables found:')
console.log(`   API Key: ${RESEND_API_KEY.substring(0, 10)}...`)
console.log(`   From Email: ${RESEND_FROM_EMAIL}\n`)

// Initialize Resend client
const resend = new Resend(RESEND_API_KEY)

async function testResendConnection() {
  try {
    console.log('🚀 Testing Resend API connection...\n')

    // Test 1: Send a simple test email
    const result = await resend.emails.send({
      from: RESEND_FROM_EMAIL!,
      to: 'delivered@resend.dev', // Resend's test email that always succeeds
      subject: 'Test Email from OnlineDoctorNote',
      html: '<p>This is a test email to verify Resend integration.</p>',
    })

    console.log('✅ Email sent successfully!')
    console.log('   Email ID:', result.data?.id)
    console.log('\n📧 Test email sent to: delivered@resend.dev (Resend test address)')
    console.log('\n✅ Resend is working correctly!\n')

    return true
  } catch (error) {
    console.error('❌ Failed to send test email:')

    if (error instanceof Error) {
      console.error('   Error:', error.message)

      // Check for common errors
      if (error.message.includes('API key')) {
        console.error('\n💡 Tip: Your API key may be invalid or expired.')
        console.error('   Get a new one at: https://resend.com/api-keys')
      } else if (error.message.includes('domain')) {
        console.error('\n💡 Tip: You may need to verify your sending domain.')
        console.error('   Check: https://resend.com/domains')
      }
    } else {
      console.error('   Unknown error:', error)
    }

    return false
  }
}

// Run the test
testResendConnection()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('Unexpected error:', error)
    process.exit(1)
  })
