import type pg from 'pg'
import { dateOnlyFromUtcDate } from '@/lib/dates'
import { env } from '@/lib/env'
import { createPool, run } from './pool'
import { raw, sql, type Sql } from './sql'

export const ANALYTICS_ROW_LIMIT = 500

const DATE_OID = 1082
const NUMERIC_OID = 1700

export type AnalyticsRow = Record<string, unknown>

export type AnalyticsResult = { columns: string[]; rows: AnalyticsRow[]; truncated: boolean }

export type AnalyticsColumn = { name: string; type: string; description: string | null }

export type AnalyticsView = {
  name: string
  description: string | null
  columns: AnalyticsColumn[]
}

type SchemaRow = {
  view_name: string
  view_description: string | null
  column_name: string
  column_type: string
  column_description: string | null
}

declare global {
  var odnAnalyticsPool: pg.Pool | undefined
}

export function isAnalyticsConfigured(): boolean {
  return env.ANALYTICS_DATABASE_URL !== undefined
}

function analyticsPool(): pg.Pool {
  const url = env.ANALYTICS_DATABASE_URL
  if (!url) throw new Error('ANALYTICS_DATABASE_URL is not set')
  globalThis.odnAnalyticsPool ??= createPool(url, { max: 2 })
  return globalThis.odnAnalyticsPool
}

export async function closeAnalyticsPool(): Promise<void> {
  const pool = globalThis.odnAnalyticsPool
  globalThis.odnAnalyticsPool = undefined
  await pool?.end()
}

const connectionErrorRejectsTheQuery = () => undefined

async function asReader(query: Sql<unknown>): Promise<pg.QueryResult> {
  const client = await analyticsPool().connect()
  client.on('error', connectionErrorRejectsTheQuery)
  try {
    await run(client, sql`BEGIN READ ONLY`)
    await run(client, sql`SET LOCAL ROLE analytics_reader`)
    await run(client, sql`SET LOCAL search_path TO analytics`)
    await run(client, sql`SET LOCAL statement_timeout TO 10000`)
    return await run(client, query)
  } finally {
    const broken = await run(client, sql`ROLLBACK`).then(
      () => undefined,
      (error: Error) => error
    )
    client.removeListener('error', connectionErrorRejectsTheQuery)
    client.release(broken)
  }
}

function serialize(value: unknown, type: number): unknown {
  if (value instanceof Date) {
    return type === DATE_OID ? dateOnlyFromUtcDate(value) : value.toISOString()
  }
  if (type === NUMERIC_OID && typeof value === 'string') return Number(value)
  return value
}

export async function runAnalyticsQuery(text: string): Promise<AnalyticsResult> {
  const body = text.replace(/[\s;]+$/, '')
  const result = await asReader(sql`SELECT * FROM (
${raw(body)}
) AS q LIMIT ${ANALYTICS_ROW_LIMIT + 1}`)
  const rows = result.rows
    .slice(0, ANALYTICS_ROW_LIMIT)
    .map((row: AnalyticsRow) =>
      Object.fromEntries(
        result.fields.map((field) => [field.name, serialize(row[field.name], field.dataTypeID)])
      )
    )
  return {
    columns: result.fields.map((field) => field.name),
    rows,
    truncated: result.rows.length > ANALYTICS_ROW_LIMIT,
  }
}

export async function describeAnalyticsSchema(): Promise<AnalyticsView[]> {
  const result = await asReader(
    sql`SELECT c.relname AS view_name, obj_description(c.oid, 'pg_class') AS view_description, a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS column_type, col_description(c.oid, a.attnum) AS column_description FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid WHERE n.nspname = 'analytics' ORDER BY c.relname, a.attnum`
  )
  const rows: SchemaRow[] = result.rows
  const views: AnalyticsView[] = []
  for (const row of rows) {
    let view = views.at(-1)
    if (view?.name !== row.view_name) {
      view = { name: row.view_name, description: row.view_description, columns: [] }
      views.push(view)
    }
    view.columns.push({
      name: row.column_name,
      type: row.column_type,
      description: row.column_description,
    })
  }
  return views
}
