import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

export const auth = betterAuth({
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

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth',

  trustedOrigins: ['http://localhost:3000', process.env.BETTER_AUTH_URL || ''].filter(Boolean),
})

export type Session = typeof auth.$Infer.Session
