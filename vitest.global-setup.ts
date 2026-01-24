import { startPrismaDevServer } from '@prisma/dev'

let server: Awaited<ReturnType<typeof startPrismaDevServer>> | null = null

export async function setup() {
  // Start a local PostgreSQL-compatible server using PGlite
  // This is 100% isolated from production - runs entirely on localhost
  server = await startPrismaDevServer({
    name: `vitest-${Date.now()}`,
    persistenceMode: 'stateless', // Fresh DB each test run
  })

  // Set DATABASE_URL for Prisma client
  process.env.DATABASE_URL = server.database.connectionString
  process.env.PRISMA_DATABASE_URL = server.database.connectionString

  console.log('\n🗄️  Prisma Dev server started for testing')
  console.log(`   Connection: ${server.database.connectionString.split('@')[1]?.split('/')[0] ?? 'localhost'}`)
}

export async function teardown() {
  if (server) {
    await server.close()
    console.log('\n🗄️  Prisma Dev server stopped')
  }
}
