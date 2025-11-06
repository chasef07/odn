/**
 * Seed Script: Add Doctor Account
 * Usage: npx ts-node scripts/seed-doctor.ts <email> <password>
 * Example: npx ts-node scripts/seed-doctor.ts doctor@example.com password123
 */

import prisma from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  const args = process.argv.slice(2)

  if (args.length !== 2) {
    console.error('Usage: npx ts-node scripts/seed-doctor.ts <email> <password>')
    console.error('Example: npx ts-node scripts/seed-doctor.ts doctor@example.com password123')
    process.exit(1)
  }

  const [email, password] = args

  // Validate email format
  if (!email.includes('@')) {
    console.error('Error: Invalid email format')
    process.exit(1)
  }

  // Validate password length
  if (password.length < 6) {
    console.error('Error: Password must be at least 6 characters')
    process.exit(1)
  }

  try {
    // Check if doctor already exists
    const existingDoctor = await prisma.doctor.findUnique({
      where: { email },
    })

    if (existingDoctor) {
      console.error(`Error: Doctor with email ${email} already exists`)
      process.exit(1)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create doctor
    const doctor = await prisma.doctor.create({
      data: {
        email,
        password: hashedPassword,
      },
    })

    console.log('✅ Doctor account created successfully!')
    console.log(`Email: ${doctor.email}`)
    console.log(`ID: ${doctor.id}`)
    console.log(`\nYou can now log in at: /admin/login`)
  } catch (error) {
    console.error('Error creating doctor account:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
