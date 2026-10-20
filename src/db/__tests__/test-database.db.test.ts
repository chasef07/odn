import pg from 'pg'
import { expect, it } from 'vitest'
import { localTestDatabaseUrl, startTestDatabase } from '../test-database'

it('answers the query queued behind a failed extended-protocol query with its own result', async () => {
  const database = await startTestDatabase({ migrated: false })
  const client = new pg.Client({ connectionString: database.url })
  await client.connect()
  const extended = (text: string) => ({ text, queryMode: 'extended' }) as pg.QueryConfig
  try {
    await client.query('CREATE TABLE probe (id int PRIMARY KEY)')
    await client.query('INSERT INTO probe VALUES (1)')

    const duplicate = client.query(extended('INSERT INTO probe VALUES (1)'))
    const afterDuplicate = client.query(extended('SELECT 1 AS one'))
    const divide = client.query(extended('SELECT 1/0'))
    const afterDivide = client.query(extended('SELECT 2 AS two'))

    await expect(duplicate).rejects.toThrow('duplicate key')
    expect((await afterDuplicate).rows).toEqual([{ one: 1 }])
    await expect(divide).rejects.toThrow('division by zero')
    expect((await afterDivide).rows).toEqual([{ two: 2 }])
  } finally {
    await client.end()
    await database.stop()
  }
})

it('refuses a localhost url whose host query parameter points pg at another server', () => {
  expect(() =>
    localTestDatabaseUrl('postgresql://localhost/prod_test?host=db.example.com')
  ).toThrow('TEST_DATABASE_URL must name a localhost database ending in _test')
})

it.each([
  'postgresql://postgres@db.example.com:5432/odn_test',
  'postgresql://postgres@localhost:5432/odn',
])('refuses %s', (url) => {
  expect(() => localTestDatabaseUrl(url)).toThrow(
    'TEST_DATABASE_URL must name a localhost database'
  )
})

it.each([
  'postgresql://postgres@localhost:55461/odn_p6_test',
  'postgresql://postgres@127.0.0.1:5432/odn_test',
])('accepts %s', (url) => {
  expect(localTestDatabaseUrl(url)).toBe(url)
})
