import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import bcrypt from 'bcryptjs'
import { env } from '@/lib/env'
import prisma from './prisma'

function createAuth() {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      password: {
        hash: async (password: string) => {
          return bcrypt.hash(password, 10)
        },
        verify: async ({ password, hash }: { password: string; hash: string }) => {
          return bcrypt.compare(password, hash)
        },
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

let authInstance: ReturnType<typeof createAuth> | null = null

function getAuth() {
  authInstance ??= createAuth()
  return authInstance
}

export const auth = {
  get api() {
    return getAuth().api
  },
  handler(request: Request): Promise<Response> {
    return getAuth().handler(request)
  },
}
