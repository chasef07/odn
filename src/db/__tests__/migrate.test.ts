import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { checksumOf, loadMigrations, MIGRATIONS_DIR, MigrationError } from '../migrate'

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
