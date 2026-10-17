import pg from 'pg'
import { env } from '@/lib/env'
import type { Sql } from './sql'

const TIMESTAMP_OID = 1114
const DATE_OID = 1082
const INT8_OID = 20

const utcTypes: pg.CustomTypesConfig = {
  getTypeParser(oid, format) {
    if (format === 'binary') return pg.types.getTypeParser(oid, format)
    if (oid === TIMESTAMP_OID) return (text: string) => new Date(`${text.replace(' ', 'T')}Z`)
    if (oid === DATE_OID) return (text: string) => new Date(`${text}T00:00:00.000Z`)
    if (oid === INT8_OID) return Number
    return pg.types.getTypeParser(oid, format)
  },
}

declare global {
  var odnPool: pg.Pool | undefined
}

export function createPool(connectionString: string): pg.Pool {
  pg.defaults.parseInputDatesAsUTC = true
  const pool = new pg.Pool({ connectionString, types: utcTypes, options: '-c TimeZone=UTC' })
  pool.on('error', (error) => {
    const { code } = error as NodeJS.ErrnoException
    console.error('Idle database connection failed', { message: error.message, code })
  })
  return pool
}

export function getPool(): pg.Pool {
  globalThis.odnPool ??= createPool(env.DATABASE_URL)
  return globalThis.odnPool
}

export async function closePool(): Promise<void> {
  const pool = globalThis.odnPool
  globalThis.odnPool = undefined
  await pool?.end()
}

type Queryable = Pick<pg.Pool, 'query'> | pg.PoolClient

export type Db = {
  rows<R>(query: Sql<R>): Promise<R[]>
  one<R>(query: Sql<R>): Promise<R | null>
  affected(query: Sql<unknown>): Promise<number>
}

async function run(client: Queryable, query: Sql<unknown>): Promise<pg.QueryResult> {
  const { text, values } = query.compile()
  const result = await client.query(text, values)
  const names = result.fields.map((field) => field.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate) {
    throw new Error(`query returns the column "${duplicate}" twice; prefix one selection`)
  }
  return result
}

function over(client: Queryable): Db {
  return {
    rows: async (query) => (await run(client, query)).rows,
    one: async (query) => (await run(client, query)).rows[0] ?? null,
    affected: async (query) => (await run(client, query)).rowCount ?? 0,
  }
}

export const db: Db & { transaction<T>(work: (tx: Db) => Promise<T>): Promise<T> } = {
  rows: (query) => over(getPool()).rows(query),
  one: (query) => over(getPool()).one(query),
  affected: (query) => over(getPool()).affected(query),
  async transaction(work) {
    const client = await getPool().connect()
    let broken: Error | undefined
    const onError = (error: Error) => {
      broken = error
    }
    client.on('error', onError)
    try {
      await client.query('BEGIN')
      const result = await work(over(client))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch((rollbackError: Error) => {
        broken = rollbackError
      })
      throw error
    } finally {
      client.removeListener('error', onError)
      client.release(broken)
    }
  },
}
