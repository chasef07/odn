import type { TestProject } from 'vitest/node'
import { loadMigrations, migrate } from './src/db/migrate'
import { createPool } from './src/db/pool'
import { startTestDatabase, type TestDatabase } from './src/db/test-database'

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string
  }
}

let database: TestDatabase | null = null

async function migrateExternal(url: string): Promise<TestDatabase> {
  const pool = createPool(url)
  await migrate(pool, loadMigrations())
  await pool.end()
  return { url, stop: async () => undefined }
}

export async function setup(project: TestProject) {
  const external = process.env.TEST_DATABASE_URL
  if (external) {
    const { hostname, pathname } = new URL(external)
    if (!['localhost', '127.0.0.1'].includes(hostname) || !pathname.endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must name a localhost database ending in _test; its tables are truncated before every test'
      )
    }
  }
  database = external ? await migrateExternal(external) : await startTestDatabase()
  project.provide('testDatabaseUrl', database.url)
}

export async function teardown() {
  await database?.stop()
}
