import { afterAll, beforeEach, inject } from 'vitest'
import { closePool, getPool } from '../pool'

const testDatabaseUrl = inject('testDatabaseUrl')
process.env.DATABASE_URL = testDatabaseUrl

beforeEach(async () => {
  if (process.env.DATABASE_URL !== testDatabaseUrl) {
    throw new Error('DATABASE_URL is not the test database; refusing to truncate it')
  }
  const { rows } = await getPool().query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'"
  )
  if (rows.length === 0) return
  const tables = rows.map((row) => `"${row.tablename}"`).join(', ')
  await getPool().query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await closePool()
})
