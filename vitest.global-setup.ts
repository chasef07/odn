import { startPrismaDevServer } from '@prisma/dev'

let server: Awaited<ReturnType<typeof startPrismaDevServer>> | null = null

export async function setup() {
  server = await startPrismaDevServer({
    name: `vitest-${Date.now()}`,
    persistenceMode: 'stateless',
  })

  process.env.DATABASE_URL = server.database.connectionString

  console.log('\n🗄️  Prisma Dev server started for testing')
  console.log(
    `   Connection: ${server.database.connectionString.split('@')[1]?.split('/')[0] ?? 'localhost'}`
  )
}

export async function teardown() {
  if (server) {
    await server.close()
    console.log('\n🗄️  Prisma Dev server stopped')
  }
}
