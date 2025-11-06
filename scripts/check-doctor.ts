/**
 * Check Doctor Account Script
 * Usage: npx ts-node scripts/check-doctor.ts <email>
 * Example: npx ts-node scripts/check-doctor.ts doctor@example.com
 */

import prisma from '../src/lib/prisma'

async function checkDoctor() {
  try {
    const args = process.argv.slice(2)

    if (args.length !== 1) {
      console.error('Usage: npx ts-node scripts/check-doctor.ts <email>')
      console.error('Example: npx ts-node scripts/check-doctor.ts doctor@example.com')
      process.exit(1)
    }

    const email = args[0]

    // Validate email format
    if (!email.includes('@')) {
      console.error('Error: Invalid email format')
      process.exit(1)
    }

    console.log(`🔍 Checking doctor account: ${email}\n`)

    const doctor = await prisma.doctor.findUnique({
      where: { email },
    })

    if (doctor) {
      console.log('✅ Doctor found:')
      console.log(`   ID: ${doctor.id}`)
      console.log(`   Email: ${doctor.email}`)
      console.log(`   Password hash: ${doctor.password}`)
      console.log(`   Created: ${doctor.createdAt}`)
      console.log(`   Updated: ${doctor.updatedAt}`)
    } else {
      console.log('❌ No doctor found with that email')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkDoctor()
