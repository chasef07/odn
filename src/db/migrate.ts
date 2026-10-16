import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Pool, PoolClient } from 'pg'
import { closePool, getPool } from './pool'

export const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations')

const FILE_NAME = /^(\d{4})_[a-z0-9_]+\.sql$/
const LOCK_KEY = 7204911
const CREATE_LEDGER = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`

export type Migration = { name: string; checksum: string; sql: string }

export type MigrationRefusal =
  | 'bad_file_name'
  | 'gap_in_sequence'
  | 'adopt_required'
  | 'checksum_mismatch'
  | 'applied_without_file'
  | 'apply_failed'
  | 'no_prisma_history'
  | 'prisma_history_unexpected'
  | 'schema_migrations_not_empty'

export class MigrationError extends Error {
  readonly reason: MigrationRefusal

  constructor(reason: MigrationRefusal, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'MigrationError'
    this.reason = reason
  }
}

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql).digest('hex')
}

export function loadMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  return files.map((file, index) => {
    const match = FILE_NAME.exec(file)
    if (!match) {
      throw new MigrationError('bad_file_name', `${file} must be named NNNN_slug.sql`)
    }
    const expected = String(index + 1).padStart(4, '0')
    if (match[1] !== expected) {
      throw new MigrationError('gap_in_sequence', `${file} should be numbered ${expected}`)
    }
    const sql = readFileSync(path.join(dir, file), 'utf8')
    return { name: file.slice(0, -'.sql'.length), checksum: checksumOf(sql), sql }
  })
}

export type MigrateResult = { applied: string[]; alreadyApplied: number }

export async function migrate(pool: Pool, migrations = loadMigrations()): Promise<MigrateResult> {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])
    const applied = (await ledgerExists(client)) ? await appliedMigrations(client) : new Map()
    if (applied.size === 0 && (await hasPrismaHistory(client))) {
      throw new MigrationError(
        'adopt_required',
        'schema_migrations is empty but _prisma_migrations has applied rows. Run `npx tsx scripts/adopt-prisma-migrations.ts` once against this database first.'
      )
    }
    await client.query(CREATE_LEDGER)
    const byName = new Map(migrations.map((migration) => [migration.name, migration]))
    for (const [name, checksum] of applied) {
      const file = byName.get(name)
      if (!file) {
        throw new MigrationError('applied_without_file', `${name} is applied but has no file`)
      }
      if (file.checksum !== checksum) {
        throw new MigrationError(
          'checksum_mismatch',
          `${name} was applied with checksum ${checksum} but the file now has ${file.checksum}`
        )
      }
    }
    const pending = migrations.filter((migration) => !applied.has(migration.name))
    for (const migration of pending) await applyMigration(client, migration)
    return { applied: pending.map((migration) => migration.name), alreadyApplied: applied.size }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY])
    client.release()
  }
}

async function applyMigration(client: PoolClient, migration: Migration): Promise<void> {
  await client.query('BEGIN')
  try {
    await client.query(migration.sql)
    await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
      migration.name,
      migration.checksum,
    ])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw new MigrationError('apply_failed', `${migration.name}: ${describe(error)}`, error)
  }
}

export async function migrateDatabase(): Promise<MigrateResult> {
  try {
    return await migrate(getPool())
  } finally {
    await closePool()
  }
}

export type AdoptResult = { adopted: string[] }

type PrismaMigrationRow = {
  migration_name: string
  checksum: string
  finished_at: Date | null
  rolled_back_at: Date | null
}

export async function adoptPrismaHistory(
  pool: Pool,
  migrations = loadMigrations()
): Promise<AdoptResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
    if (!(await hasPrismaTable(client))) {
      throw new MigrationError('no_prisma_history', 'this database has no _prisma_migrations table')
    }
    const { rows } = await client.query<PrismaMigrationRow>(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name'
    )
    const finished = new Map<string, PrismaMigrationRow>()
    for (const row of rows) {
      if (row.finished_at && !row.rolled_back_at) finished.set(row.migration_name, row)
    }
    for (const row of rows) {
      if (!finished.has(row.migration_name)) {
        throw new MigrationError(
          'prisma_history_unexpected',
          `${row.migration_name} never finished or was rolled back`
        )
      }
    }
    const bySlug = new Map(
      migrations.map((migration) => [migration.name.replace(/^\d{4}_/, ''), migration])
    )
    const adoptions = [...finished.values()].map((row) => {
      const file = bySlug.get(row.migration_name.replace(/^\d+_/, ''))
      if (!file) {
        throw new MigrationError(
          'prisma_history_unexpected',
          `${row.migration_name} has no file in ${MIGRATIONS_DIR}`
        )
      }
      if (file.checksum !== row.checksum) {
        throw new MigrationError(
          'checksum_mismatch',
          `${row.migration_name} was recorded with checksum ${row.checksum} but ${file.name}.sql has ${file.checksum}`
        )
      }
      return { file, appliedAt: row.finished_at }
    })
    await client.query(CREATE_LEDGER)
    const existing = await appliedMigrations(client)
    if (existing.size > 0) {
      const alreadyAdopted = adoptions.every(
        ({ file }) => existing.get(file.name) === file.checksum
      )
      if (!alreadyAdopted) {
        throw new MigrationError(
          'schema_migrations_not_empty',
          `schema_migrations already has ${existing.size} rows that are not the Prisma history`
        )
      }
      await client.query('COMMIT')
      return { adopted: [] }
    }
    for (const { file, appliedAt } of adoptions) {
      await client.query(
        'INSERT INTO schema_migrations (name, checksum, applied_at) VALUES ($1, $2, $3)',
        [file.name, file.checksum, appliedAt]
      )
    }
    await client.query('COMMIT')
    return { adopted: adoptions.map(({ file }) => file.name) }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function adoptPrismaMigrations(): Promise<AdoptResult> {
  try {
    return await adoptPrismaHistory(getPool())
  } finally {
    await closePool()
  }
}

async function appliedMigrations(client: PoolClient): Promise<Map<string, string>> {
  const { rows } = await client.query<{ name: string; checksum: string }>(
    'SELECT name, checksum FROM schema_migrations ORDER BY name'
  )
  return new Map(rows.map((row) => [row.name, row.checksum]))
}

async function tableExists(client: PoolClient, name: string): Promise<boolean> {
  const { rows } = await client.query<{ present: boolean }>(
    'SELECT to_regclass($1) IS NOT NULL AS present',
    [name]
  )
  return rows[0].present
}

function ledgerExists(client: PoolClient): Promise<boolean> {
  return tableExists(client, 'schema_migrations')
}

function hasPrismaTable(client: PoolClient): Promise<boolean> {
  return tableExists(client, '_prisma_migrations')
}

async function hasPrismaHistory(client: PoolClient): Promise<boolean> {
  if (!(await hasPrismaTable(client))) return false
  const { rows } = await client.query<{ present: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS present'
  )
  return rows[0].present
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
