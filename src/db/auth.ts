import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { db, getPool } from './pool'
import { sql } from './sql'
import { insert, select } from './table'
import { accounts, sessions, users, verifications } from './tables'
import { deleteEveryRow } from './wipe'

type AuthOptions = Omit<
  BetterAuthOptions,
  'database' | 'user' | 'account' | 'session' | 'verification'
> & {
  user?: Pick<NonNullable<BetterAuthOptions['user']>, 'validateUserInfo'>
  session?: Omit<NonNullable<BetterAuthOptions['session']>, 'modelName' | 'fields'>
}

export function createAuth(options: AuthOptions) {
  return betterAuth({
    ...options,
    database: getPool(),
    user: {
      ...options.user,
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
    verification: {
      modelName: verifications.name,
      fields: {
        expiresAt: verifications.columns.expiresAt.name,
        createdAt: verifications.columns.createdAt.name,
        updatedAt: verifications.columns.updatedAt.name,
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

export async function deleteAllAuthSessions(): Promise<void> {
  await deleteEveryRow(sessions)
}

export async function deleteAllAuthAccounts(): Promise<void> {
  await deleteEveryRow(accounts)
}

export async function deleteAllAuthUsers(): Promise<void> {
  await deleteEveryRow(users)
}
