import { expect, it } from 'vitest'
import { disconnectDatabase } from '../connection'
import { getPool } from '../pool'

it('closes the pool and lets the next query open a fresh one', async () => {
  const before = getPool()
  await before.query('SELECT 1')

  await disconnectDatabase()

  expect(before.ended).toBe(true)
  const after = getPool()
  expect(after).not.toBe(before)
  await expect(after.query('SELECT 1 AS one')).resolves.toMatchObject({ rows: [{ one: 1 }] })
})
