import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import pg from 'pg'
import { loadMigrations, migrate } from './migrate'
import { createPool } from './pool'

export function localTestDatabaseUrl(url: string): string {
  const { host, database } = new pg.Client({ connectionString: url })
  if (!['localhost', '127.0.0.1'].includes(host) || !database?.endsWith('_test')) {
    throw new Error(
      'TEST_DATABASE_URL must name a localhost database ending in _test; its tables are truncated before every test'
    )
  }
  return url
}

export type TestDatabase = { url: string; stop(): Promise<void> }

const EXTENDED_PROTOCOL_MESSAGES = new Set([...'PBDECH'].map((type) => type.charCodeAt(0)))
const READY_FOR_QUERY = 'Z'.charCodeAt(0)

function withoutReadyForQuery(response: Uint8Array): Uint8Array {
  const view = new DataView(response.buffer, response.byteOffset, response.byteLength)
  const kept: Uint8Array[] = []
  for (let at = 0; at < response.length;) {
    const end = at + 1 + view.getInt32(at + 1)
    if (response[at] !== READY_FOR_QUERY) kept.push(response.subarray(at, end))
    at = end
  }
  return Buffer.concat(kept)
}

function readyOnlyAfterSync(db: PGlite): PGlite {
  return new Proxy(db, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (property !== 'execProtocolRawStream') {
        return typeof value === 'function' ? value.bind(target) : value
      }
      return async (message: Uint8Array, options: { onRawData(data: Uint8Array): void }) => {
        if (!EXTENDED_PROTOCOL_MESSAGES.has(message[0])) {
          return target.execProtocolRawStream(message, options)
        }
        const chunks: Uint8Array[] = []
        await target.execProtocolRawStream(message, {
          ...options,
          onRawData: (data) => chunks.push(data.slice()),
        })
        const response = withoutReadyForQuery(Buffer.concat(chunks))
        if (response.length > 0) options.onRawData(response)
      }
    },
  })
}

const startParams = [...PGlite.defaultStartParams, '-c', 'TimeZone=UTC']

async function createPGlite(database: string): Promise<PGlite> {
  if (database === 'postgres') return PGlite.create({ startParams })
  const template = await PGlite.create()
  await template.exec(`CREATE DATABASE "${database}"`)
  const dataDir = await template.dumpDataDir('none')
  await template.close()
  return PGlite.create({ loadDataDir: dataDir, database, startParams })
}

export async function startTestDatabase({
  migrated = true,
  database = 'postgres',
} = {}): Promise<TestDatabase> {
  const db = await createPGlite(database)
  const server = new PGLiteSocketServer({
    db: readyOnlyAfterSync(db),
    host: '127.0.0.1',
    port: 0,
    maxConnections: 32,
  })
  await server.start()
  const url = `postgresql://postgres@${server.getServerConn()}/${database}`
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
