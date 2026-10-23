import { isAllowlistedAdmin } from '@/lib/admin-allowlist'
import { env } from '@/lib/env'
import { createAuth } from '@/db/auth'

function configureAuth() {
  return createAuth({
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
      },
    },

    user: {
      validateUserInfo: ({ user }) =>
        isAllowlistedAdmin(user)
          ? undefined
          : {
              error: 'not_an_admin',
              errorDescription: 'This Google account is not allowed to use the admin portal',
            },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
  })
}

let authInstance: ReturnType<typeof configureAuth> | null = null

function getAuth() {
  authInstance ??= configureAuth()
  return authInstance
}

export const auth = {
  get api() {
    return getAuth().api
  },
  get $context() {
    return getAuth().$context
  },
  handler(request: Request): Promise<Response> {
    return getAuth().handler(request)
  },
}
