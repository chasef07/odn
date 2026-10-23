import { createCredentialAccount, createVerifiedUser } from '../src/db/auth'
import { disconnectDatabase } from '../src/db/connection'
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
    const user = await createVerifiedUser({ email, name })

    await createCredentialAccount({
      userId: user.id,
      password: hashedPassword,
    })

    console.log(`Doctor user created: ${email} (${user.id})`)
  } finally {
    await disconnectDatabase()
  }
}

createDoctorUser().catch((error) => {
  console.error('Error creating doctor user:', error)
  process.exit(1)
})
