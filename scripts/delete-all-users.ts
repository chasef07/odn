import { deleteAllAuthAccounts, deleteAllAuthSessions, deleteAllAuthUsers } from '../src/db/auth'
import { disconnectDatabase } from '../src/db/connection'

async function deleteAllUsers() {
  try {
    await deleteAllAuthSessions()
    console.log('✓ Deleted all sessions')

    await deleteAllAuthAccounts()
    console.log('✓ Deleted all accounts')

    await deleteAllAuthUsers()
    console.log('✓ Deleted all users')

    console.log('\n✅ All users deleted successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await disconnectDatabase()
  }
}

deleteAllUsers()
