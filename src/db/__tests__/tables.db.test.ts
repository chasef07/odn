import { describe, expect, it } from 'vitest'
import { getPool } from '../pool'
import type { Column } from '../table'
import { tables } from '../tables'
import { DENIAL_REASONS, NoteVerificationStatus, SubmissionStatus } from '../types'

type ColumnRow = {
  column_name: string
  is_nullable: 'YES' | 'NO'
  data_type: string
  udt_name: string
}

const KIND_OF_DATA_TYPE: Record<string, Column['kind']> = {
  text: 'text',
  integer: 'int',
  boolean: 'bool',
  'timestamp without time zone': 'timestamp',
  date: 'date',
  jsonb: 'jsonb',
  'USER-DEFINED': 'enum',
}

const LABELS_OF_ENUM: Record<string, string[]> = {
  SubmissionStatus: Object.values(SubmissionStatus).sort(),
  NoteVerificationStatus: Object.values(NoteVerificationStatus).sort(),
}

function liveKind(row: ColumnRow): string {
  return KIND_OF_DATA_TYPE[row.data_type] ?? `${row.data_type} (${row.udt_name})`
}

describe('every table descriptor matches the migrated schema', () => {
  it('registers every public table the migrations create', async () => {
    const { rows } = await getPool().query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename"
    )

    expect(rows.map((row) => row.tablename)).toEqual(
      Object.values(tables)
        .map((table) => table.name)
        .sort()
    )
  })

  it('every enum column has exactly the labels src/db/types.ts exports', async () => {
    const { rows } = await getPool().query<{
      table_name: string
      column_name: string
      udt_name: string
    }>(
      "SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'USER-DEFINED' ORDER BY table_name, column_name"
    )
    expect(rows.length).toBeGreaterThan(0)

    for (const { table_name, column_name, udt_name } of rows) {
      const { rows: labels } = await getPool().query<{ enumlabel: string }>(
        'SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = $1',
        [udt_name]
      )
      expect(
        labels.map((label) => label.enumlabel).sort(),
        `${table_name}.${column_name} is ${udt_name}`
      ).toEqual(LABELS_OF_ENUM[udt_name])
    }
  })

  it('the denial_reason check admits exactly the denial reasons src/db/types.ts exports', async () => {
    const { rows } = await getPool().query<{ definition: string }>(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'submissions_denial_reason_check'"
    )
    const literals = [...rows[0].definition.matchAll(/'((?:[^']|'')*)'::text/g)].map(
      ([, literal]) => literal.replaceAll("''", "'")
    )

    expect(literals.sort()).toEqual([...DENIAL_REASONS].sort())
  })

  for (const table of Object.values(tables)) {
    it(`${table.name}: every column exists, nothing is missing, and nullability and kind match`, async () => {
      const { rows } = await getPool().query<ColumnRow>(
        'SELECT column_name, is_nullable, data_type, udt_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
        ['public', table.name]
      )
      const live = new Map(
        rows.map((row) => [
          row.column_name,
          { nullable: row.is_nullable === 'YES', kind: liveKind(row) },
        ])
      )
      const declared = new Map(
        Object.values(table.columns as Record<string, Column>).map((column) => [
          column.name,
          { nullable: column.nullable, kind: column.kind },
        ])
      )

      expect(Object.fromEntries(declared)).toEqual(Object.fromEntries(live))

      const columns = [...declared.keys()].map((name) => `"${name}"`).join(', ')
      await expect(
        getPool().query(`SELECT ${columns} FROM "${table.name}" LIMIT 0`)
      ).resolves.toBeTruthy()
    })
  }
})
