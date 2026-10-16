import type { TestProject } from 'vitest/node'
import { startTestDatabase, type TestDatabase } from './src/db/test-database'

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string
  }
}

let database: TestDatabase | null = null

export async function setup(project: TestProject) {
  database = await startTestDatabase()
  project.provide('testDatabaseUrl', database.url)
}

export async function teardown() {
  await database?.stop()
}
