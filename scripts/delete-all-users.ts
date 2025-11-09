import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteAllUsers() {
  try {
    await prisma.session.deleteMany({})
    console.log('✓ Deleted all sessions')

    await prisma.account.deleteMany({})
    console.log('✓ Deleted all accounts')

    await prisma.user.deleteMany({})
    console.log('✓ Deleted all users')

    console.log('\n✅ All users deleted successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteAllUsers()
