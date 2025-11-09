/**
 * Better Auth Configuration
 * Handles authentication for admin portal
 */

import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for admin portal (internal use only)
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      // Use bcrypt for password hashing (industry standard)
      hash: async (password: string) => {
        return bcrypt.hash(password, 10)
      },
      verify: async ({ password, hash }: { password: string; hash: string }) => {
        return bcrypt.compare(password, hash)
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true, // Enable for better performance
      maxAge: 5 * 60, // Cache for 5 minutes
    },
  },

  // Security configuration
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  basePath: "/api/auth",

  // CSRF protection - trust localhost and production domain only
  trustedOrigins: [
    "http://localhost:3000",
    process.env.BETTER_AUTH_URL || "",
  ].filter(Boolean),
})

// Export type-safe client inference
export type Session = typeof auth.$Infer.Session
