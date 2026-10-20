import pg from 'pg'
import { afterEach, describe, expect, inject, it, vi } from 'vitest'
import { deleteAllAuthAccounts, deleteAllAuthSessions, deleteAllAuthUsers } from '../auth'
import { countSubmissions, deleteAllSubmissions, insertSubmission } from '../submissions'
import { closePool } from '../pool'
import { startTestDatabase } from '../test-database'
import { wipeRefusal } from '../wipe'

const PROXIED_PRODUCTION = 'postgresql://odn_app:hunter2@127.0.0.1:5432/onlinedoctornote'
const DUPLICATE_HOST =
  'postgresql://odn_app:hunter2@localhost/odn_dev?host=localhost&host=/cloudsql/acuity-health-prod:us-east4:onlinedoctornote-db'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('wipeRefusal', () => {
  it('allows only odn, postgres and databases named *_dev or *_test', () => {
    for (const database of ['odn', 'postgres', 'odn_dev', 'odn_test', 'p9_dev']) {
      expect(wipeRefusal(PROXIED_PRODUCTION, database), database).toBeNull()
    }
    for (const database of [
      'onlinedoctornote',
      'onlinedoctornote_staging',
      'odn_development',
      'test',
      'odn_test_copy',
    ]) {
      expect(wipeRefusal('postgresql://postgres@localhost/x', database), database).not.toBeNull()
    }
  })

  it('refuses production reached through the Cloud SQL Auth Proxy on 127.0.0.1', () => {
    const refusal = wipeRefusal(PROXIED_PRODUCTION, 'onlinedoctornote')

    expect(refusal).toContain('database "onlinedoctornote" on host "127.0.0.1"')
    expect(refusal).not.toContain('hunter2')
  })

  it('names the host and port pg takes from PGHOST and PGPORT when the URL has none', () => {
    vi.stubEnv('PGHOST', '/cloudsql/acuity-health-prod:us-east4:onlinedoctornote-db')
    vi.stubEnv('PGPORT', '6543')

    expect(wipeRefusal('postgresql:///onlinedoctornote', 'onlinedoctornote')).toContain(
      'on host "/cloudsql/acuity-health-prod:us-east4:onlinedoctornote-db" port 6543'
    )
  })

  it('names the host pg connects to when the URL repeats the host parameter', () => {
    expect(wipeRefusal(DUPLICATE_HOST, 'onlinedoctornote')).toContain(
      'on host "/cloudsql/acuity-health-prod:us-east4:onlinedoctornote-db"'
    )
  })
})

describe('the delete-every-row functions', () => {
  it('refuse a production database and leave its rows', async () => {
    const production = await startTestDatabase({ database: 'onlinedoctornote' })
    const testDatabaseUrl = process.env.DATABASE_URL
    await closePool()
    process.env.DATABASE_URL = production.url
    try {
      await insertSubmission({
        stripePaymentIntentId: 'pi_production',
        state: 'CA',
        recipient: 'myself',
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientDateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
        email: 'john@example.com',
        phone: '(555) 123-4567',
        notePurpose: 'work',
        firstDayOff: new Date('2026-03-02T00:00:00.000Z'),
        lastDayOff: new Date('2026-03-04T00:00:00.000Z'),
        absenceReason: 'illness',
      })

      await expect(deleteAllSubmissions()).rejects.toThrow(
        'Refusing to delete every row in database "onlinedoctornote"'
      )
      expect(await countSubmissions()).toBe(1)
    } finally {
      await closePool()
      process.env.DATABASE_URL = testDatabaseUrl
      await production.stop()
    }
  })

  it('print the database and host they are about to wipe', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await deleteAllSubmissions()
    await deleteAllAuthSessions()
    await deleteAllAuthAccounts()
    await deleteAllAuthUsers()

    const { database, host } = new pg.Client({ connectionString: inject('testDatabaseUrl') })
    const target = `in database "${database}" on host "${host}" port `
    expect(info.mock.calls.map(([line]) => line)).toEqual([
      expect.stringContaining(`Deleting every row of submissions ${target}`),
      expect.stringContaining(`Deleting every row of sessions ${target}`),
      expect.stringContaining(`Deleting every row of accounts ${target}`),
      expect.stringContaining(`Deleting every row of users ${target}`),
    ])
  })
})
