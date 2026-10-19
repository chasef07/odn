import { parse } from 'pg-connection-string'
import { env } from '@/lib/env'
import { db } from './pool'
import { expression, identifier, sql } from './sql'
import type { Table } from './table'

const WIPEABLE_DATABASE = /^(?:odn|postgres|\w+_(?:dev|test))$/
const currentDatabase = expression<string>()('name', sql`current_database()`)

function describeTarget(databaseUrl: string, database: string): string {
  const { host, port } = parse(databaseUrl)
  return `database "${database}" on host "${host || 'default'}"${port ? ` port ${port}` : ''}`
}

export function wipeRefusal(databaseUrl: string, database: string): string | null {
  if (WIPEABLE_DATABASE.test(database)) return null
  return `Refusing to delete every row in ${describeTarget(databaseUrl, database)}. Only odn, postgres and databases named *_dev or *_test can be wiped.`
}

export async function deleteEveryRow<D>(table: Table<D>): Promise<number> {
  const row = await db.one(sql`SELECT ${currentDatabase}`)
  if (!row) throw new Error('current_database() returned no row')
  const refusal = wipeRefusal(env.DATABASE_URL, row.name)
  if (refusal) throw new Error(refusal)
  console.info(
    `Deleting every row of ${table.name} in ${describeTarget(env.DATABASE_URL, row.name)}`
  )
  return db.affected(sql`DELETE FROM ${identifier(table.name)}`)
}
