/**
 * Create Doctor User for Better Auth
 * Uses bcrypt for password hashing (simpler and more standard)
 * Run with: npx tsx scripts/create-doctor-user.ts
 */

import prisma from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

async function createDoctorUser() {
  const email = 'fagenchase@gmail.com'
  const password = 'Doctor@2024'
  const name = 'Dr. Admin'

  console.log('🔐 Hashing password with bcrypt...')
  // Use bcrypt instead of scrypt - it's a standard format
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        emailVerified: true,
      },
    })

    console.log('✓ User created:', user.id)

    // Create account with password
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        accountId: email,
        providerId: 'credential',
        password: hashedPassword,
      },
    })

    console.log('✓ Account created:', account.id)
    console.log('\n✅ Doctor user created successfully!')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('Password hash (bcrypt):', hashedPassword)
    console.log('\nYou can now log in at http://localhost:3000/admin/login')
  } catch (error) {
    console.error('❌ Error creating doctor user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createDoctorUser()
