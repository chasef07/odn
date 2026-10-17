import { AsyncLocalStorage } from 'node:async_hooks'
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

type Transaction = { client(): pg.PoolClient; depth: number }

const current = new AsyncLocalStorage<Transaction>()

function extended(text: string, values: unknown[] = []): pg.QueryConfig {
  return { text, values, queryMode: 'extended' } as pg.QueryConfig
}

async function run(client: Queryable, query: Sql<unknown>): Promise<pg.QueryResult> {
  const { text, values } = query.compile()
  const result = await client.query(extended(text, values))
  const names = result.fields.map((field) => field.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate) {
    throw new Error(`query returns the column "${duplicate}" twice; prefix one selection`)
  }
  return result
}

function over(source: () => Queryable): Db {
  return {
    rows: async (query) => (await run(source(), query)).rows,
    one: async (query) => (await run(source(), query)).rows[0] ?? null,
    affected: async (query) => (await run(source(), query)).rowCount ?? 0,
  }
}

function begin(client: pg.PoolClient, depth: number) {
  let finished = false
  const transaction: Transaction = {
    depth,
    client() {
      if (finished) throw new Error('tx handle used after the transaction finished')
      return client
    },
  }
  return {
    transaction,
    tx: over(transaction.client),
    finish: () => {
      finished = true
    },
  }
}

async function nested<T>(outer: Transaction, work: (tx: Db) => Promise<T>): Promise<T> {
  const client = outer.client()
  const savepoint = `sp${outer.depth + 1}`
  const { transaction, tx, finish } = begin(client, outer.depth + 1)
  await client.query(extended(`SAVEPOINT ${savepoint}`))
  try {
    const result = await current.run(transaction, () => work(tx))
    await client.query(extended(`RELEASE SAVEPOINT ${savepoint}`))
    return result
  } catch (error) {
    await client.query(extended(`ROLLBACK TO SAVEPOINT ${savepoint}`))
    throw error
  } finally {
    finish()
  }
}

export const db: Db & { transaction<T>(work: (tx: Db) => Promise<T>): Promise<T> } = {
  ...over(() => current.getStore()?.client() ?? getPool()),
  async transaction(work) {
    const outer = current.getStore()
    if (outer) return nested(outer, work)
    const client = await getPool().connect()
    const { transaction, tx, finish } = begin(client, 0)
    let broken: Error | undefined
    const onError = (error: Error) => {
      broken = error
    }
    client.on('error', onError)
    try {
      await client.query(extended('BEGIN'))
      const result = await current.run(transaction, () => work(tx))
      await client.query(extended('COMMIT'))
      return result
    } catch (error) {
      await client.query(extended('ROLLBACK')).catch((rollbackError: Error) => {
        broken = rollbackError
      })
      throw error
    } finally {
      finish()
      client.removeListener('error', onError)
      client.release(broken)
    }
  },
}
