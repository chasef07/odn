import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { loadMigrations, migrate } from './migrate'
import { createPool } from './pool'

export type TestDatabase = { url: string; stop(): Promise<void> }

export async function startTestDatabase({ migrated = true } = {}): Promise<TestDatabase> {
  const db = await PGlite.create()
  await db.exec("SET TimeZone TO 'UTC'")
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 32 })
  await server.start()
  const url = `postgresql://postgres@${server.getServerConn()}/postgres`
  if (migrated) {
    const pool = createPool(url)
    await migrate(pool, loadMigrations())
    await pool.end()
  }
  return {
    url,
    async stop() {
      await server.stop()
      await db.close()
    },
  }
}
