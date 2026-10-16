import pg from 'pg'
import { env } from '@/lib/env'

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
    console.error('Idle database connection failed:', error)
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
