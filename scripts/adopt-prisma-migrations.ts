import { config } from 'dotenv'
import { adoptPrismaMigrations, MigrationError } from '@/db/migrate'

config({ path: ['.env.local', '.env'], quiet: true })

async function main() {
  try {
    const result = await adoptPrismaMigrations()
    if (result.adopted.length === 0) {
      console.log('Prisma history was already adopted. Nothing changed.')
      return
    }
    console.log(`Adopted ${result.adopted.length} migrations: ${result.adopted.join(', ')}`)
  } catch (error) {
    if (error instanceof MigrationError) {
      console.error(`Adopt refused (${error.reason}): ${error.message}`)
      process.exitCode = 1
      return
    }
    throw error
  }
}

main()
