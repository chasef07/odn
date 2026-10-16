import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import { auth } from '@/lib/auth'
import {
  createCredentialAccount,
  createVerifiedUser,
  deleteAllAuthAccounts,
  deleteAllAuthSessions,
  deleteAllAuthUsers,
} from '../auth'
import { db } from '../pool'
import { count, sql } from '../sql'
import { select } from '../table'
import { sessions, users } from '../tables'

const email = 'doctor@example.test'
const password = 'correct horse battery staple'

async function seedDoctor(): Promise<string> {
  const user = await createVerifiedUser({ email, name: 'Dr Test' })
  await createCredentialAccount({
    userId: user.id,
    accountId: user.id,
    password: await bcrypt.hash(password, 10),
  })
  return user.id
}

async function sessionCount(): Promise<number> {
  const row = await db.one(sql`SELECT ${count('n')} FROM sessions`)
  return row?.n ?? 0
}

describe('better-auth on the pg pool', () => {
  it('creates a verified user with a generated id and timestamps', async () => {
    const { id } = await createVerifiedUser({ email, name: 'Dr Test' })

    const row = await db.one(
      sql`SELECT ${select(users, ['id', 'email', 'emailVerified', 'name', 'createdAt', 'updatedAt'])} FROM users`
    )
    expect(row).toMatchObject({ id, email, emailVerified: true, name: 'Dr Test' })
    expect(row?.createdAt).toBeInstanceOf(Date)
    expect(row?.updatedAt).toBeInstanceOf(Date)
  })

  it('signs in with email and password, reads the session back, and signs out', async () => {
    const userId = await seedDoctor()

    const signIn = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    })
    expect(signIn.status).toBe(200)
    const cookie = signIn.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('better-auth.session_token=')
    expect(await sessionCount()).toBe(1)

    const stored = await db.one(
      sql`SELECT ${select(sessions, ['userId', 'expiresAt', 'createdAt'])} FROM sessions`
    )
    expect(stored?.userId).toBe(userId)
    expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)

    const headers = new Headers({ cookie: cookie.split(';')[0] })
    const session = await auth.api.getSession({ headers })
    expect(session?.user).toMatchObject({ id: userId, email, name: 'Dr Test', emailVerified: true })
    expect(session?.session.userId).toBe(userId)

    const signOut = await auth.api.signOut({ headers, asResponse: true })
    expect(signOut.status).toBe(200)
    expect(await sessionCount()).toBe(0)
    expect(await auth.api.getSession({ headers })).toBeNull()
  })

  it('rejects a wrong password and an unknown email', async () => {
    await seedDoctor()

    const wrong = await auth.api.signInEmail({
      body: { email, password: 'wrong' },
      asResponse: true,
    })
    const unknown = await auth.api.signInEmail({
      body: { email: 'nobody@example.test', password },
      asResponse: true,
    })

    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(await sessionCount()).toBe(0)
  })

  it('deletes sessions, accounts and users', async () => {
    await seedDoctor()
    await auth.api.signInEmail({ body: { email, password }, asResponse: true })

    await deleteAllAuthSessions()
    expect(await sessionCount()).toBe(0)
    await deleteAllAuthAccounts()
    expect(await db.one(sql`SELECT ${count('n')} FROM accounts`)).toEqual({ n: 0 })
    await deleteAllAuthUsers()
    expect(await db.one(sql`SELECT ${count('n')} FROM users`)).toEqual({ n: 0 })
  })
})
