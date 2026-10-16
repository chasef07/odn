import { describe, expect, it } from 'vitest'
import { getPool } from '../pool'
import type { Column } from '../table'
import { tables } from '../tables'

type ColumnRow = { column_name: string; is_nullable: 'YES' | 'NO'; data_type: string }

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

  for (const table of Object.values(tables)) {
    it(`${table.name}: every column exists, nothing is missing, and nullability and jsonb match`, async () => {
      const { rows } = await getPool().query<ColumnRow>(
        'SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
        ['public', table.name]
      )
      const live = new Map(
        rows.map((row) => [
          row.column_name,
          { nullable: row.is_nullable === 'YES', json: row.data_type === 'jsonb' },
        ])
      )
      const declared = new Map(
        Object.values(table.columns as Record<string, Column>).map((column) => [
          column.name,
          { nullable: column.nullable, json: column.json },
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
