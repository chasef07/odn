import { EventEmitter } from 'node:events'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { checksumOf, loadMigrations, migrate, MIGRATIONS_DIR, MigrationError } from '../migrate'

const tempDirs: string[] = []

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

function dirWith(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'odn-migrations-'))
  tempDirs.push(dir)
  for (const [name, sql] of Object.entries(files)) writeFileSync(path.join(dir, name), sql)
  return dir
}

function refusal(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    if (error instanceof MigrationError) return error.reason
    throw error
  }
  throw new Error('expected a MigrationError')
}

describe('loadMigrations', () => {
  it('loads the repo migrations in order with sha256 checksums', () => {
    const migrations = loadMigrations(MIGRATIONS_DIR)
    const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql'))
    expect(migrations.map((m) => `${m.name}.sql`)).toEqual([...files].sort())
    expect(migrations.length).toBeGreaterThan(0)
    expect(migrations[0].checksum).toBe(checksumOf(migrations[0].sql))
  })

  it('keeps the seven Prisma-era files byte for byte, so their checksums match the recorded history', () => {
    const recorded = Object.fromEntries(
      loadMigrations(MIGRATIONS_DIR).map((m) => [m.name, m.checksum])
    )
    expect(recorded).toEqual({
      '0001_baseline_production_schema':
        '31380f0353cb9f28e5ffb26a3d8b325df12500d062a0739022706ae3fe1c744c',
      '0002_add_sms_support_automation':
        '9ccd17f788b264286de51bbfaeb0c5b6358162bd61c9c4fdca199a2bf9e0373d',
      '0003_add_telnyx_event_status':
        'a177d52a8802df1d6b5e775a921fec190dd9afa2515e61c680581f6c3eb38952',
      '0004_add_sms_message_support_handled_at':
        '06611d988e759e1706e386b1f8b1cbb1af2715ee57b75281b25298de4ed0e4e7',
      '0005_add_active_sms_support_job_unique_index':
        '7003f2ed1efca73737220bcacae8be14430bce059de7eefdd67633b38fc5b04e',
      '0006_add_follow_up_email_delivery':
        '121fe92406c9090b7df1172d3c42ed8f26a7b00b29df1290ad8000d6173552a3',
      '0007_add_submission_attribution':
        '8a0a187e09ab1fce7058352c9409dfbdc655200d65cc82a2d4fe4a3120825670',
    })
  })

  it('reads files in name order and ignores non-sql files', () => {
    const dir = dirWith({ '0002_b.sql': 'b', '0001_a.sql': 'a', 'notes.txt': 'x' })
    expect(loadMigrations(dir).map((m) => [m.name, m.sql])).toEqual([
      ['0001_a', 'a'],
      ['0002_b', 'b'],
    ])
  })

  it('refuses a file that is not named NNNN_slug.sql', () => {
    expect(refusal(() => loadMigrations(dirWith({ 'add_column.sql': '' })))).toBe('bad_file_name')
    expect(refusal(() => loadMigrations(dirWith({ '0001_Add-Column.sql': '' })))).toBe(
      'bad_file_name'
    )
  })

  it('refuses a file that controls its own transaction, wherever the statement sits', () => {
    const refused = [
      'BEGIN;\nCREATE TABLE t (id int);',
      'CREATE TABLE t (id int);\nSTART TRANSACTION;',
      'CREATE TABLE t (id int);\n  commit;',
      'CREATE TABLE t (id int);COMMIT;',
      'CREATE TABLE t (id int);\nEND;',
      'CREATE TABLE t (id int);\nROLLBACK;',
      'CREATE TABLE t (id int);\nABORT;',
      'CREATE TABLE t (id int);\nSAVEPOINT s;',
      "CREATE TABLE t (id int);\nPREPARE TRANSACTION 'deploy';",
      '-- the runner wraps this file\nCOMMIT;',
      '/* the runner wraps this file */ ROLLBACK;',
    ]
    for (const sql of refused) {
      expect(
        refusal(() => loadMigrations(dirWith({ '0001_a.sql': sql }))),
        sql
      ).toBe('transaction_control')
    }
  })

  it('accepts transaction words inside quoted bodies, comments, expressions and longer identifiers', () => {
    const accepted = {
      '0001_a.sql': "INSERT INTO t VALUES ('begin the end')",
      '0002_b.sql': 'UPDATE t SET a = CASE WHEN b THEN 1 ELSE 0\nEND',
      '0003_c.sql': 'DO $$\nBEGIN\n  PERFORM 1;\nEND $$;',
      '0004_d.sql':
        'CREATE FUNCTION f() RETURNS trigger AS $body$\nBEGIN\n  RETURN NEW;\nEND;\n$body$ LANGUAGE plpgsql;',
      '0005_e.sql':
        '-- the runner owns the transaction; COMMIT happens there\nCREATE TABLE t (id int);',
      '0006_f.sql': 'CREATE TABLE t (id int); /* no undo here; ROLLBACK is the runner job */',
      '0007_g.sql': "INSERT INTO t VALUES ('it''s; COMMIT;')",
      '0008_h.sql': 'SELECT 1;\nBEGINNING',
      '0009_i.sql': 'COMMITTED;',
    }
    expect(loadMigrations(dirWith(accepted))).toHaveLength(9)
  })

  it("reads backslash escapes only inside E'' strings", () => {
    const refused = [
      "SELECT E'\\''; BEGIN; SELECT '';",
      "SELECT E'C:\\\\'; COMMIT;",
      "SELECT date'a\\'; COMMIT; SELECT 'b';",
    ]
    for (const sql of refused) {
      expect(
        refusal(() => loadMigrations(dirWith({ '0001_a.sql': sql }))),
        sql
      ).toBe('transaction_control')
    }
    const accepted = {
      '0001_a.sql': "INSERT INTO t VALUES (e'it\\'s; COMMIT;')",
      '0002_b.sql': "INSERT INTO t VALUES (E'it''s \\' ; COMMIT; ')",
    }
    expect(loadMigrations(dirWith(accepted))).toHaveLength(2)
  })

  it('refuses a gap or a duplicate number', () => {
    expect(refusal(() => loadMigrations(dirWith({ '0001_a.sql': '', '0003_c.sql': '' })))).toBe(
      'gap_in_sequence'
    )
    expect(refusal(() => loadMigrations(dirWith({ '0001_a.sql': '', '0001_b.sql': '' })))).toBe(
      'gap_in_sequence'
    )
    expect(refusal(() => loadMigrations(dirWith({ '0002_b.sql': '' })))).toBe('gap_in_sequence')
  })
})

type ClientCall =
  | { query: string; values?: unknown[]; errorListeners: number }
  | { release: unknown; errorListeners: number }

function fakePool(lockError?: Error): { pool: Pool; calls: ClientCall[] } {
  const calls: ClientCall[] = []
  const client = Object.assign(new EventEmitter(), {
    async query(text: string, values?: unknown[]) {
      calls.push({ query: text, values, errorListeners: client.listenerCount('error') })
      if (lockError && text.includes('pg_advisory_lock')) throw lockError
      return { rows: text.includes('to_regclass') ? [{ present: false }] : [] }
    },
    release(destroy?: unknown) {
      calls.push({ release: destroy, errorListeners: client.listenerCount('error') })
    },
  })
  return { pool: { connect: async () => client } as unknown as Pool, calls }
}

function pgError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

describe('migrate locking', () => {
  it('bounds the lock wait, resets the timeout once locked, and destroys the client afterwards', async () => {
    const { pool, calls } = fakePool()

    expect(await migrate(pool, [])).toEqual({ applied: [], alreadyApplied: 0 })

    expect(calls.slice(0, 3)).toEqual([
      {
        query: 'SELECT set_config($1, $2, false)',
        values: ['lock_timeout', '2min'],
        errorListeners: 1,
      },
      { query: 'SELECT pg_advisory_lock($1)', values: [7204911], errorListeners: 1 },
      { query: 'RESET lock_timeout', values: undefined, errorListeners: 1 },
    ])
    expect(calls.every((call) => 'release' in call || call.errorListeners === 1)).toBe(true)
    expect(calls.at(-1)).toEqual({ release: true, errorListeners: 0 })
  })

  it('reports a lock wait that timed out as lock_timeout, carrying the database error', async () => {
    const timeout = pgError('55P03', 'canceling statement due to lock timeout')
    const { pool, calls } = fakePool(timeout)

    const error = await migrate(pool, [], '500ms').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(MigrationError)
    expect((error as MigrationError).reason).toBe('lock_timeout')
    expect((error as MigrationError).cause).toBe(timeout)
    expect(calls).toEqual([
      {
        query: 'SELECT set_config($1, $2, false)',
        values: ['lock_timeout', '500ms'],
        errorListeners: 1,
      },
      { query: 'SELECT pg_advisory_lock($1)', values: [7204911], errorListeners: 1 },
      { release: true, errorListeners: 0 },
    ])
  })

  it('rethrows any other failure while waiting for the lock unchanged', async () => {
    const terminated = pgError('57P01', 'terminating connection due to administrator command')
    const { pool, calls } = fakePool(terminated)

    await expect(migrate(pool, [])).rejects.toBe(terminated)
    expect(calls.at(-1)).toEqual({ release: true, errorListeners: 0 })
  })
})
