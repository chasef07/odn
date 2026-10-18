import pg from 'pg'
import { expect, it } from 'vitest'
import { startTestDatabase } from '../test-database'

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
