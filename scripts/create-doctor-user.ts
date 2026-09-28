import prisma from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

async function createDoctorUser() {
  const email = requireEnv('ADMIN_EMAIL')
  const name = requireEnv('ADMIN_NAME')
  const password = requireEnv('ADMIN_PASSWORD')

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        emailVerified: true,
      },
    })

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: email,
        providerId: 'credential',
        password: hashedPassword,
      },
    })

    console.log(`Doctor user created: ${email} (${user.id})`)
  } finally {
    await prisma.$disconnect()
  }
}

createDoctorUser().catch((error) => {
  console.error('Error creating doctor user:', error)
  process.exit(1)
})
