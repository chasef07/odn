import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteAllAuthSessions } from '../auth'
import { deleteAllSubmissions } from '../submissions'
import { wipeRefusal } from '../wipe'

const PROXIED_PRODUCTION = 'postgresql://odn_app:hunter2@127.0.0.1:5432/onlinedoctornote'
const DUPLICATE_HOST =
  'postgresql://odn_app:hunter2@localhost/odn_dev?host=localhost&host=/cloudsql/acuity-health-prod:us-east4:onlinedoctornote-db'

afterEach(() => {
  vi.restoreAllMocks()
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

  it('names the host pg connects to when the URL repeats the host parameter', () => {
    expect(wipeRefusal(DUPLICATE_HOST, 'onlinedoctornote')).toContain(
      'on host "/cloudsql/acuity-health-prod:us-east4:onlinedoctornote-db"'
    )
  })
})

describe('the delete-every-row functions', () => {
  it('print the database and host they are about to wipe', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await deleteAllSubmissions()
    await deleteAllAuthSessions()

    expect(info.mock.calls.map(([line]) => line)).toEqual([
      expect.stringMatching(
        /^Deleting every row of submissions in database "postgres" on host "127\.0\.0\.1"/
      ),
      expect.stringMatching(
        /^Deleting every row of sessions in database "postgres" on host "127\.0\.0\.1"/
      ),
    ])
  })
})
