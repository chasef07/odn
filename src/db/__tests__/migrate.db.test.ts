import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  adoptPrismaHistory,
  checksumOf,
  loadMigrations,
  migrate,
  MigrationError,
  type Migration,
} from '../migrate'
import { createPool } from '../pool'
import { startTestDatabase, type TestDatabase } from '../test-database'

let database: TestDatabase
let pool: ReturnType<typeof createPool>

beforeAll(async () => {
  database = await startTestDatabase({ migrated: false })
  pool = createPool(database.url)
})

afterAll(async () => {
  await pool.end()
  await database.stop()
})

beforeEach(async () => {
  await pool.query('SELECT pg_advisory_unlock_all(); RESET lock_timeout')
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
})

function migration(name: string, sql: string): Migration {
  return { name, checksum: checksumOf(sql), sql }
}

const first = migration('0001_create_things', 'CREATE TABLE things (id text PRIMARY KEY)')
const second = migration('0002_add_label', 'ALTER TABLE things ADD COLUMN label text')

async function ledger(): Promise<{ name: string; checksum: string }[]> {
  const { rows } = await pool.query('SELECT name, checksum FROM schema_migrations ORDER BY name')
  return rows
}

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (error) {
    if (error instanceof MigrationError) return error.reason
    throw error
  }
  throw new Error('expected a MigrationError')
}

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', [name])
  return rows[0].present
}

describe('migrate', () => {
  it('applies pending files in order, each recorded with its checksum', async () => {
    const result = await migrate(pool, [first, second])

    expect(result).toEqual({ applied: [first.name, second.name], alreadyApplied: 0 })
    expect(await ledger()).toEqual([
      { name: first.name, checksum: first.checksum },
      { name: second.name, checksum: second.checksum },
    ])
    await pool.query("INSERT INTO things (id, label) VALUES ('a', 'b')")
  })

  it('does nothing on a rerun and applies only the new file later', async () => {
    await migrate(pool, [first])

    expect(await migrate(pool, [first])).toEqual({ applied: [], alreadyApplied: 1 })
    expect(await migrate(pool, [first, second])).toEqual({
      applied: [second.name],
      alreadyApplied: 1,
    })
  })

  it('rolls a failing file back whole and leaves no ledger row, so a fixed file applies cleanly', async () => {
    const broken = migration(
      '0002_add_label',
      'ALTER TABLE things ADD COLUMN label text; ALTER TABLE missing ADD COLUMN x text'
    )
    await migrate(pool, [first])

    expect(await refusal(() => migrate(pool, [first, broken]))).toBe('apply_failed')
    expect(await ledger()).toEqual([{ name: first.name, checksum: first.checksum }])
    const columns = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'things'"
    )
    expect(columns.rows.map((row) => row.column_name)).toEqual(['id'])

    expect(await migrate(pool, [first, second])).toEqual({
      applied: [second.name],
      alreadyApplied: 1,
    })
  })

  it('rolls the file back when its ledger row cannot be written', async () => {
    const refusesItsLedgerRow = migration(
      '0001_create_things',
      `CREATE TABLE things (id text PRIMARY KEY);
CREATE FUNCTION refuse_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'no ledger row'; END $$;
CREATE TRIGGER refuse_ledger BEFORE INSERT ON schema_migrations FOR EACH ROW EXECUTE FUNCTION refuse_ledger();`
    )

    expect(await refusal(() => migrate(pool, [refusesItsLedgerRow]))).toBe('apply_failed')
    expect(await tableExists('things')).toBe(false)
    expect(await ledger()).toEqual([])
  })

  it('starts each file from a reset session, so a setting an earlier file changed cannot hide a COMMIT', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'odn-migrations-'))
    writeFileSync(path.join(dir, '0001_flip_strings.sql'), 'SET standard_conforming_strings = off')
    writeFileSync(
      path.join(dir, '0002_hidden_commit.sql'),
      String.raw`CREATE TABLE hidden_commit (id int);
SELECT '\', '; COMMIT; SELECT 'x';
SELECT 1/0;`
    )
    const migrations = loadMigrations(dir)
    rmSync(dir, { recursive: true })

    expect(await refusal(() => migrate(pool, migrations))).toBe('apply_failed')
    expect(await tableExists('hidden_commit')).toBe(false)
    expect(await ledger()).toEqual([
      { name: '0001_flip_strings', checksum: migrations[0].checksum },
    ])
  })

  it('holds the advisory lock with no lock_timeout while a file runs', async () => {
    const probe = migration(
      '0001_probe_lock',
      `CREATE TABLE lock_probe AS SELECT
  current_setting('lock_timeout') AS lock_timeout,
  EXISTS (
    SELECT 1 FROM pg_locks
    WHERE locktype = 'advisory' AND objid = 7204911 AND pid = pg_backend_pid()
  ) AS holds_lock`
    )

    await migrate(pool, [probe])

    const { rows } = await pool.query('SELECT lock_timeout, holds_lock FROM lock_probe')
    expect(rows).toEqual([{ lock_timeout: '0', holds_lock: true }])
  })

  it('refuses when an applied file was edited', async () => {
    await migrate(pool, [first])
    const edited = migration(first.name, 'CREATE TABLE things (id text PRIMARY KEY, extra text)')

    expect(await refusal(() => migrate(pool, [edited, second]))).toBe('checksum_mismatch')
    expect(await tableExists('things')).toBe(true)
    expect(await ledger()).toHaveLength(1)
  })

  it('refuses when the database has an applied migration the code does not know', async () => {
    await migrate(pool, [first, second])

    expect(await refusal(() => migrate(pool, [first]))).toBe('applied_without_file')
  })

  it('applies the real migration files to an empty database and the rerun is a no-op', async () => {
    const migrations = loadMigrations()

    const result = await migrate(pool, migrations)

    expect(result.applied).toEqual(migrations.map((m) => m.name))
    expect(await tableExists('submissions')).toBe(true)
    expect(await tableExists('sms_support_jobs')).toBe(true)
    expect(await migrate(pool, migrations)).toEqual({
      applied: [],
      alreadyApplied: migrations.length,
    })
  })
})

const PRISMA_LEDGER = `CREATE TABLE _prisma_migrations (
  id varchar(36) PRIMARY KEY,
  checksum varchar(64) NOT NULL,
  finished_at timestamptz,
  migration_name varchar(255) NOT NULL,
  logs text,
  rolled_back_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  applied_steps_count integer NOT NULL DEFAULT 0
)`

async function applyLikePrisma(
  migrations: Migration[],
  prismaNames: string[],
  options: { checksumFor?: (m: Migration) => string } = {}
): Promise<void> {
  await pool.query(PRISMA_LEDGER)
  for (const [index, migration] of migrations.entries()) {
    await pool.query(migration.sql)
    await pool.query(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
       VALUES ($1, $2, $3, $4, 1)`,
      [
        `id-${index}`,
        options.checksumFor?.(migration) ?? migration.checksum,
        new Date(Date.UTC(2026, 5, 17 + index, 12)),
        prismaNames[index],
      ]
    )
  }
}

const prismaNames = ['20260617000000_create_things', '20260629000000_add_label']

describe('adoptPrismaHistory', () => {
  it('refuses to migrate a database with Prisma history until it is adopted', async () => {
    await applyLikePrisma([first, second], prismaNames)

    expect(await refusal(() => migrate(pool, [first, second]))).toBe('adopt_required')
    expect(await tableExists('schema_migrations')).toBe(false)
  })

  it('copies the finished Prisma rows into schema_migrations with their timestamps', async () => {
    await applyLikePrisma([first, second], prismaNames)

    const result = await adoptPrismaHistory(pool, [first, second])

    expect(result).toEqual({ adopted: [first.name, second.name] })
    const { rows } = await pool.query(
      'SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name'
    )
    expect(rows).toEqual([
      {
        name: first.name,
        checksum: first.checksum,
        applied_at: new Date(Date.UTC(2026, 5, 17, 12)),
      },
      {
        name: second.name,
        checksum: second.checksum,
        applied_at: new Date(Date.UTC(2026, 5, 18, 12)),
      },
    ])
    expect(await migrate(pool, [first, second])).toEqual({ applied: [], alreadyApplied: 2 })
  })

  it('is a no-op the second time and leaves _prisma_migrations in place', async () => {
    await applyLikePrisma([first, second], prismaNames)
    await adoptPrismaHistory(pool, [first, second])

    expect(await adoptPrismaHistory(pool, [first, second])).toEqual({ adopted: [] })
    expect(await tableExists('_prisma_migrations')).toBe(true)
    expect(await ledger()).toHaveLength(2)
  })

  it('refuses loudly when a recorded checksum differs from the file', async () => {
    await applyLikePrisma([first, second], prismaNames, { checksumFor: () => 'deadbeef' })

    expect(await refusal(() => adoptPrismaHistory(pool, [first, second]))).toBe('checksum_mismatch')
    expect(await tableExists('schema_migrations')).toBe(false)
  })

  it('refuses when a Prisma migration has no file, never finished, or there is no Prisma table', async () => {
    expect(await refusal(() => adoptPrismaHistory(pool, [first]))).toBe('no_prisma_history')
    await pool.query(PRISMA_LEDGER)
    expect(await refusal(() => adoptPrismaHistory(pool, [first]))).toBe('no_prisma_history')
    await pool.query('DROP TABLE _prisma_migrations')

    await applyLikePrisma([first, second], prismaNames)
    expect(await refusal(() => adoptPrismaHistory(pool, [first]))).toBe('prisma_history_unexpected')

    await pool.query(
      "INSERT INTO _prisma_migrations (id, checksum, migration_name) VALUES ('x', 'abc', '20260701000000_half_done')"
    )
    expect(await refusal(() => adoptPrismaHistory(pool, [first, second]))).toBe(
      'prisma_history_unexpected'
    )
  })

  it('refuses an unresolved failed attempt even when a finished twin exists, and accepts a rolled-back one', async () => {
    await applyLikePrisma([first], ['20260617000000_create_things'])
    await pool.query(
      "INSERT INTO _prisma_migrations (id, checksum, migration_name) VALUES ('failed', $1, '20260617000000_create_things')",
      [first.checksum]
    )
    expect(await refusal(() => adoptPrismaHistory(pool, [first]))).toBe('prisma_history_unexpected')

    await pool.query("UPDATE _prisma_migrations SET rolled_back_at = now() WHERE id = 'failed'")
    expect(await adoptPrismaHistory(pool, [first])).toEqual({ adopted: [first.name] })
  })

  it('refuses when schema_migrations already holds something else', async () => {
    await applyLikePrisma([first], ['20260617000000_create_things'])
    await pool.query(
      'CREATE TABLE schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())'
    )
    await pool.query("INSERT INTO schema_migrations (name, checksum) VALUES ('0001_other', 'abc')")

    expect(await refusal(() => adoptPrismaHistory(pool, [first]))).toBe(
      'schema_migrations_not_empty'
    )
  })

  it('adopts the real seven Prisma-era files, then migrate applies the files after them', async () => {
    const migrations = loadMigrations()
    await applyLikePrisma(migrations.slice(0, 7), [
      '20260617000000_baseline_production_schema',
      '20260629000000_add_sms_support_automation',
      '20260629010000_add_telnyx_event_status',
      '20260629020000_add_sms_message_support_handled_at',
      '20260629030000_add_active_sms_support_job_unique_index',
      '20260823000000_add_follow_up_email_delivery',
      '20261007000000_add_submission_attribution',
    ])

    expect((await adoptPrismaHistory(pool, migrations)).adopted).toHaveLength(7)
    expect(await migrate(pool, migrations)).toEqual({
      applied: migrations.slice(7).map((m) => m.name),
      alreadyApplied: 7,
    })
  })

  it('refuses to migrate once a Prisma migration landed after the cutover', async () => {
    await applyLikePrisma([first], ['20260617000000_create_things'])
    await adoptPrismaHistory(pool, [first])
    expect(await migrate(pool, [first, second])).toEqual({
      applied: [second.name],
      alreadyApplied: 1,
    })

    const third = migration('0003_add_note', 'ALTER TABLE things ADD COLUMN note text')
    await pool.query(third.sql)
    await pool.query(
      "INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at) VALUES ('late', $1, '20260801000000_add_note', now())",
      [third.checksum]
    )

    expect(await refusal(() => migrate(pool, [first, second, third]))).toBe('prisma_drift')
    expect(await ledger()).toHaveLength(2)
  })

  it('migrates a fresh database whose only Prisma attempt was rolled back', async () => {
    await pool.query(PRISMA_LEDGER)
    await pool.query(
      "INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, rolled_back_at) VALUES ('undone', 'abc', '20260617000000_create_things', now(), now())"
    )

    expect(await migrate(pool, [first])).toEqual({ applied: [first.name], alreadyApplied: 0 })
  })

  it('migrates a fresh database whose only Prisma attempt never finished', async () => {
    await pool.query(PRISMA_LEDGER)
    await pool.query(
      "INSERT INTO _prisma_migrations (id, checksum, migration_name) VALUES ('unresolved', 'abc', '20260617000000_create_things')"
    )

    expect(await migrate(pool, [first])).toEqual({ applied: [first.name], alreadyApplied: 0 })
  })

  it('sees no drift after the cutover in Prisma attempts that were rolled back or never finished', async () => {
    await applyLikePrisma([first], ['20260617000000_create_things'])
    await adoptPrismaHistory(pool, [first])
    await pool.query(
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, rolled_back_at) VALUES
       ('undone', 'abc', '20260801000000_add_note', now(), now()),
       ('unresolved', 'abc', '20260802000000_add_flag', NULL, NULL)`
    )

    expect(await migrate(pool, [first, second])).toEqual({
      applied: [second.name],
      alreadyApplied: 1,
    })
  })

  it('stays a no-op after a later migration was applied by the runner', async () => {
    await applyLikePrisma([first], ['20260617000000_create_things'])
    await adoptPrismaHistory(pool, [first, second])
    await migrate(pool, [first, second])

    expect(await adoptPrismaHistory(pool, [first, second])).toEqual({ adopted: [] })
    expect(await ledger()).toHaveLength(2)
  })
})

describe('0009_constrain_denial_reason', () => {
  const SUBMISSION_COLUMNS = `id, stripe_payment_intent_id, status, state, recipient, patient_first_name,
    patient_last_name, patient_date_of_birth, email, phone, note_purpose, first_day_off,
    last_day_off, absence_reason, updated_at, denial_reason`

  async function seedLegacy(id: string, status: string, reason: string | null): Promise<void> {
    await pool.query(
      `INSERT INTO submissions (${SUBMISSION_COLUMNS}) VALUES ($1, $1, $2, 'CA', 'myself', 'J', 'D',
        '1990-01-01', 'j@example.com', '5551234567', 'work', '2026-01-01', '2026-01-02',
        'illness', now(), $3)`,
      [id, status, reason]
    )
  }

  async function denials(): Promise<[string, string | null, string | null][]> {
    const { rows } = await pool.query(
      'SELECT id, denial_reason, denial_note FROM submissions ORDER BY id'
    )
    return rows.map((row) => [row.id, row.denial_reason, row.denial_note])
  }

  async function migrateThrough0009(seed: [string, string, string | null][]): Promise<void> {
    const migrations = loadMigrations()
    const index = migrations.findIndex((m) => m.name === '0009_constrain_denial_reason')
    await migrate(pool, migrations.slice(0, index))
    for (const [id, status, reason] of seed) await seedLegacy(id, status, reason)
    expect((await migrate(pool, migrations)).applied).toEqual(
      migrations.slice(index).map((m) => m.name)
    )
  }

  it('keeps every stored reason, maps a choice typed with other case or spacing to that choice, and moves other free text into the note under Other', async () => {
    await migrateThrough0009([
      ['a', 'DENIED', 'Legal'],
      ['b', 'DENIED', 'Refund'],
      ['c', 'DENIED', '  ACCOMMODATIONS '],
      ['d', 'DENIED', 'no answer '],
      ['e', 'DENIED', 'Other'],
      ['f', 'APPROVED', '7+ days'],
      ['g', 'PENDING_REVIEW', null],
      ['h', 'DENIED', 'under  18'],
      ['i', 'DENIED', 'Refund\n'],
      ['j', 'DENIED', 'other'],
      ['k', 'DENIED', '\tduplicate'],
      ['l', 'DENIED', 'accommodations needed'],
      ['m', 'DENIED', 'refund (customer)'],
      ['n', 'DENIED', 'ACCOMMODATİONS'],
      ['o', 'DENIED', 'Under 18'],
    ])

    expect(await denials()).toEqual([
      ['a', 'Legal', null],
      ['b', 'Refund', null],
      ['c', 'Accommodations', null],
      ['d', 'Other', 'no answer '],
      ['e', 'Other', null],
      ['f', '7+ days', null],
      ['g', null, null],
      ['h', 'Under 18', null],
      ['i', 'Refund', null],
      ['j', 'Other', null],
      ['k', 'Duplicate', null],
      ['l', 'Other', 'accommodations needed'],
      ['m', 'Refund (Customer)', null],
      ['n', 'Other', 'ACCOMMODATİONS'],
      ['o', 'Other', 'Under 18'],
    ])
  })

  it('leaves the rows alone when the runner runs again', async () => {
    await migrateThrough0009([
      ['a', 'DENIED', 'DUPLICATE '],
      ['b', 'DENIED', 'duplicate twice'],
    ])
    const migrated = await denials()

    expect(await migrate(pool, loadMigrations())).toEqual({
      applied: [],
      alreadyApplied: loadMigrations().length,
    })
    expect(migrated).toEqual([
      ['a', 'Duplicate', null],
      ['b', 'Other', 'duplicate twice'],
    ])
    expect(await denials()).toEqual(migrated)
  })

  it('refuses a reason outside the list, and a note on any reason but Other', async () => {
    await migrateThrough0009([
      ['a', 'DENIED', 'Legal'],
      ['b', 'DENIED', 'no answer'],
    ])

    await expect(
      pool.query("UPDATE submissions SET denial_reason = 'Legal matter' WHERE id = 'a'")
    ).rejects.toThrow('submissions_denial_reason_check')
    await expect(
      pool.query("UPDATE submissions SET denial_note = 'court' WHERE id = 'a'")
    ).rejects.toThrow('submissions_denial_note_check')
    await expect(
      pool.query("UPDATE submissions SET denial_reason = NULL WHERE id = 'b'")
    ).rejects.toThrow('submissions_denial_note_check')
  })
})
