import { afterEach, describe, expect, it, vi } from 'vitest'
import { findAdminSession } from '@/lib/admin-session'
import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import {
  createVerifiedUser,
  deleteAllAuthAccounts,
  deleteAllAuthSessions,
  deleteAllAuthUsers,
} from '../auth'
import { db, getPool } from '../pool'
import { count, sql } from '../sql'
import { select } from '../table'
import { accounts, sessions, users } from '../tables'

const email = 'doctor@example.test'
const doctor = { sub: 'google-sub-doctor', email, email_verified: true, name: 'Dr Test' }

function unsignedIdToken(claims: Record<string, unknown>): string {
  const encode = (part: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(part)).toString('base64url')
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(claims)}.unsigned`
}

function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

async function redirectStart(): Promise<{ start: Response; authorization: URL }> {
  const start = await auth.api.signInSocial({
    body: { provider: 'google', callbackURL: '/admin', errorCallbackURL: '/admin/login' },
    asResponse: true,
  })
  return { start, authorization: new URL(((await start.json()) as { url: string }).url) }
}

async function popupStart(): Promise<{ start: Response; authorization: URL }> {
  const url = new URL(`${env.BETTER_AUTH_URL}/api/auth/oauth-popup/start`)
  url.searchParams.set('provider', 'google')
  url.searchParams.set('popupOrigin', new URL(env.BETTER_AUTH_URL).origin)
  url.searchParams.set('popupNonce', 'popup-nonce')
  url.searchParams.set('callbackURL', '/admin')
  url.searchParams.set('errorCallbackURL', '/admin/login')
  const start = await auth.handler(new Request(url))
  expect(start.status).toBe(302)
  return { start, authorization: new URL(start.headers.get('location') ?? '') }
}

async function signInWithGoogle(
  claims: Record<string, unknown>,
  begin: () => Promise<{ start: Response; authorization: URL }> = redirectStart
): Promise<Response> {
  const { start, authorization } = await begin()
  const passThrough = globalThis.fetch
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url !== 'https://oauth2.googleapis.com/token') return passThrough(input, init)
    return Response.json({
      access_token: 'google-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: unsignedIdToken({
        iss: 'https://accounts.google.com',
        aud: env.GOOGLE_CLIENT_ID,
        nonce: authorization.searchParams.get('nonce') ?? undefined,
        ...claims,
      }),
    })
  })

  const callback = new URL(`${env.BETTER_AUTH_URL}/api/auth/callback/google`)
  callback.searchParams.set('code', 'google-code')
  callback.searchParams.set('state', authorization.searchParams.get('state') ?? '')
  return auth.handler(new Request(callback, { headers: { cookie: cookiesFrom(start) } }))
}

async function signInCookie(): Promise<string> {
  const response = await signInWithGoogle(doctor)
  expect(response.headers.get('location')).toBe('/admin')
  return cookiesFrom(response)
}

async function sessionCount(): Promise<number> {
  const row = await db.one(sql`SELECT ${count('n')} FROM sessions`)
  return row?.n ?? 0
}

async function userCount(): Promise<number> {
  const row = await db.one(sql`SELECT ${count('n')} FROM users`)
  return row?.n ?? 0
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

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

  it('signs an allowlisted doctor in with Google, reads the session back, and signs out', async () => {
    const response = await signInWithGoogle(doctor)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/admin')
    const account = await db.one(
      sql`SELECT ${select(accounts, ['userId', 'accountId', 'providerId'])} FROM accounts`
    )
    expect(account).toMatchObject({ accountId: doctor.sub, providerId: 'google' })
    const stored = await db.one(
      sql`SELECT ${select(sessions, ['userId', 'expiresAt'])} FROM sessions`
    )
    expect(stored?.userId).toBe(account?.userId)
    expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)

    const headers = new Headers({ cookie: cookiesFrom(response) })
    expect(await findAdminSession(headers)).toEqual({ doctorId: account?.userId, email })

    const signOut = await auth.api.signOut({ headers, asResponse: true })
    expect(signOut.status).toBe(200)
    expect(await sessionCount()).toBe(0)
    expect(await auth.api.getSession({ headers, query: { disableCookieCache: true } })).toBeNull()
  })

  it('links Google to the existing user of an allowlisted doctor', async () => {
    const { id } = await createVerifiedUser({ email, name: 'Dr Test' })

    const headers = new Headers({ cookie: await signInCookie() })

    expect(await findAdminSession(headers)).toEqual({ doctorId: id, email })
    expect(await userCount()).toBe(1)
  })

  it('refuses a Google account that is not on ADMIN_EMAILS before any user or session exists', async () => {
    const response = await signInWithGoogle({
      sub: 'google-sub-stranger',
      email: 'stranger@example.test',
      email_verified: true,
      name: 'Stranger',
    })

    expect(response.status).toBe(302)
    expect(new URL(response.headers.get('location') ?? '', env.BETTER_AUTH_URL)).toMatchObject({
      pathname: '/admin/login',
      search: expect.stringContaining('error=not_an_admin'),
    })
    expect(response.headers.getSetCookie().join()).not.toContain('session_token=')
    expect(await userCount()).toBe(0)
    expect(await sessionCount()).toBe(0)
  })

  it('refuses an allowlisted email that Google has not verified', async () => {
    const response = await signInWithGoogle({ ...doctor, email_verified: false })

    expect(response.headers.get('location')).toContain('/admin/login?error=not_an_admin')
    expect(await userCount()).toBe(0)
    expect(await sessionCount()).toBe(0)
  })

  it('refuses a returning Google account whose email moved off ADMIN_EMAILS', async () => {
    await signInCookie()
    await deleteAllAuthSessions()

    const response = await signInWithGoogle({ ...doctor, email: 'moved@example.test' })

    expect(response.headers.get('location')).toContain('/admin/login?error=not_an_admin')
    expect(await sessionCount()).toBe(0)
  })

  it('stops admitting a live session once its email leaves ADMIN_EMAILS', async () => {
    const headers = new Headers({ cookie: await signInCookie() })

    vi.stubEnv('ADMIN_EMAILS', 'someone-else@example.test')

    expect(await auth.api.getSession({ headers })).not.toBeNull()
    expect(await findAdminSession(headers)).toBeNull()
  })

  it('has no email and password sign-in', async () => {
    await createVerifiedUser({ email, name: 'Dr Test' })

    const response = await auth.api.signInEmail({
      body: { email, password: 'correct horse battery staple' },
      asResponse: true,
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(await sessionCount()).toBe(0)
  })

  it('deletes sessions, accounts and users', async () => {
    await signInCookie()

    await deleteAllAuthSessions()
    expect(await sessionCount()).toBe(0)
    await deleteAllAuthAccounts()
    expect(await db.one(sql`SELECT ${count('n')} FROM accounts`)).toEqual({ n: 0 })
    await deleteAllAuthUsers()
    expect(await userCount()).toBe(0)
  })

  it('updates the user name and image', async () => {
    const headers = new Headers({ cookie: await signInCookie() })
    const image = 'https://example.test/doctor.png'

    const updated = await auth.api.updateUser({
      body: { name: 'Dr Renamed', image },
      headers,
      asResponse: true,
    })

    expect(updated.status).toBe(200)
    const row = await db.one(sql`SELECT ${select(users, ['name', 'image'])} FROM users`)
    expect(row).toEqual({ name: 'Dr Renamed', image })
    const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } })
    expect(session?.user).toMatchObject({ name: 'Dr Renamed', image })
  })
})

describe('Google sign-in in a popup', () => {
  function popupMessage(html: string): Record<string, unknown> {
    const json =
      /<script type="application\/json" id="better-auth-oauth-popup">([^<]*)<\/script>/.exec(
        html
      )?.[1]
    return JSON.parse(json ?? 'null') as Record<string, unknown>
  }

  it('hands the opener the session of an allowlisted doctor', async () => {
    const response = await signInWithGoogle(doctor, popupStart)

    expect(response.status).toBe(200)
    const message = popupMessage(await response.text())
    expect(message).toMatchObject({
      type: 'better-auth:oauth-popup',
      nonce: 'popup-nonce',
      targetOrigin: new URL(env.BETTER_AUTH_URL).origin,
      redirectTo: '/admin',
    })
    const headers = new Headers({ cookie: cookiesFrom(response) })
    expect(await findAdminSession(headers)).toMatchObject({ email })
  })

  it('tells the opener a Google account off ADMIN_EMAILS is not an admin, and makes no session', async () => {
    const response = await signInWithGoogle(
      { sub: 'google-sub-stranger', email: 'stranger@example.test', email_verified: true },
      popupStart
    )

    const message = popupMessage(await response.text())
    expect(message).toMatchObject({ nonce: 'popup-nonce', error: { code: 'not_an_admin' } })
    expect(message.token).toBeUndefined()
    expect(await sessionCount()).toBe(0)
  })

  it('refuses to start a popup for an origin that is not the site', async () => {
    const url = new URL(`${env.BETTER_AUTH_URL}/api/auth/oauth-popup/start`)
    url.searchParams.set('provider', 'google')
    url.searchParams.set('popupOrigin', 'https://attacker.example')

    const response = await auth.handler(new Request(url))

    expect(response.status).toBe(403)
  })
})

describe('the admin session slides through the auth route', () => {
  const day = 24 * 60 * 60 * 1000

  function sessionTokenOnly(cookie: string): Headers {
    return new Headers({
      cookie: cookie
        .split('; ')
        .filter((pair) => pair.includes('session_token='))
        .join('; '),
    })
  }

  async function storedExpiry(): Promise<number> {
    const row = await db.one(sql`SELECT ${select(sessions, ['expiresAt'])} FROM sessions`)
    return row!.expiresAt.getTime()
  }

  async function ageSessionByTwoDays(): Promise<void> {
    await getPool().query("UPDATE sessions SET expires_at = expires_at - interval '2 days'")
  }

  it('leaves the session alone when an admin page reads it, so the route can renew the cookie', async () => {
    const headers = sessionTokenOnly(await signInCookie())
    await ageSessionByTwoDays()
    const aged = await storedExpiry()

    expect(await findAdminSession(headers)).not.toBeNull()
    expect(await storedExpiry()).toBe(aged)

    const refresh = await auth.handler(
      new Request(`${env.BETTER_AUTH_URL}/api/auth/get-session`, { headers })
    )

    expect(refresh.status).toBe(200)
    const renewed = refresh.headers
      .getSetCookie()
      .find((cookie) => cookie.includes('session_token='))
    expect(renewed).toContain('Max-Age=2592000')
    expect(await storedExpiry()).toBeGreaterThan(Date.now() + 29 * day)
  })
})

describe('the auth tables carry every column better-auth writes', () => {
  it('has a table with every column for each model the configured auth uses', async () => {
    const { tables } = await auth.$context
    const missing: string[] = []

    for (const table of Object.values(tables)) {
      const { rows } = await getPool().query<{ column_name: string }>(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
        ['public', table.modelName]
      )
      const columns = rows.map((row) => row.column_name)
      for (const column of [
        'id',
        ...Object.entries(table.fields).map(([field, attributes]) => attributes.fieldName ?? field),
      ]) {
        if (!columns.includes(column)) missing.push(`${table.modelName}.${column}`)
      }
    }

    expect(Object.keys(tables).sort()).toEqual(['account', 'session', 'user', 'verification'])
    expect(missing).toEqual([])
  })
})
