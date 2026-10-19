import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { db, getPool } from './pool'
import { sql } from './sql'
import { insert, select } from './table'
import { accounts, sessions, users } from './tables'

type AuthOptions = Omit<BetterAuthOptions, 'database' | 'user' | 'account' | 'session'> & {
  session?: Omit<NonNullable<BetterAuthOptions['session']>, 'modelName' | 'fields'>
}

export function createAuth(options: AuthOptions) {
  return betterAuth({
    ...options,
    database: getPool(),
    user: {
      modelName: users.name,
      fields: {
        emailVerified: users.columns.emailVerified.name,
        createdAt: users.columns.createdAt.name,
        updatedAt: users.columns.updatedAt.name,
      },
    },
    session: {
      ...options.session,
      modelName: sessions.name,
      fields: {
        userId: sessions.columns.userId.name,
        expiresAt: sessions.columns.expiresAt.name,
        ipAddress: sessions.columns.ipAddress.name,
        userAgent: sessions.columns.userAgent.name,
        createdAt: sessions.columns.createdAt.name,
        updatedAt: sessions.columns.updatedAt.name,
      },
    },
    account: {
      modelName: accounts.name,
      fields: {
        userId: accounts.columns.userId.name,
        accountId: accounts.columns.accountId.name,
        providerId: accounts.columns.providerId.name,
        accessToken: accounts.columns.accessToken.name,
        refreshToken: accounts.columns.refreshToken.name,
        idToken: accounts.columns.idToken.name,
        accessTokenExpiresAt: accounts.columns.expiresAt.name,
        refreshTokenExpiresAt: accounts.columns.refreshTokenExpiresAt.name,
        createdAt: accounts.columns.createdAt.name,
        updatedAt: accounts.columns.updatedAt.name,
      },
    },
  })
}

export async function createVerifiedUser({
  email,
  name,
}: {
  email: string
  name: string
}): Promise<{ id: string }> {
  const row = await db.one(
    sql`${insert(users, { email, name, emailVerified: true })} RETURNING ${select(users, ['id'])}`
  )
  if (!row) throw new Error('user insert returned no row')
  return row
}

export async function createCredentialAccount({
  userId,
  accountId,
  password,
}: {
  userId: string
  accountId: string
  password: string
}): Promise<void> {
  await db.affected(
    sql`${insert(accounts, { userId, accountId, providerId: 'credential', password })}`
  )
}

export async function deleteAllAuthSessions(): Promise<void> {
  await db.affected(sql`DELETE FROM sessions`)
}

export async function deleteAllAuthAccounts(): Promise<void> {
  await db.affected(sql`DELETE FROM accounts`)
}

export async function deleteAllAuthUsers(): Promise<void> {
  await db.affected(sql`DELETE FROM users`)
}
