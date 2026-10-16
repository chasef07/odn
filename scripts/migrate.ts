import { config } from 'dotenv'
import { migrateDatabase, MigrationError } from '@/db/migrate'

config({ path: ['.env.local', '.env'], quiet: true })

async function main() {
  try {
    const result = await migrateDatabase()
    const applied = result.applied.length ? result.applied.join(', ') : 'none'
    console.log(`Applied: ${applied}. Already applied: ${result.alreadyApplied}.`)
  } catch (error) {
    if (error instanceof MigrationError) {
      console.error(`Migration refused (${error.reason}): ${error.message}`)
      process.exitCode = 1
      return
    }
    throw error
  }
}

main()
