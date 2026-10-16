import { z } from 'zod'

export function parseEnvVar<T>(name: string, schema: z.ZodType<T>, raw: string | undefined): T {
  const value = raw === '' ? undefined : raw
  const result = schema.safeParse(value)
  if (!result.success) {
    const problem =
      value === undefined
        ? 'is not set'
        : `is invalid: ${result.error.issues.map((issue) => issue.message).join('; ')}`
    throw new Error(`Environment variable ${name} ${problem}`)
  }
  return result.data
}

const siteUrl = z.url().transform((url) => url.replace(/\/+$/, ''))
const nonEmpty = z.string().trim().min(1)

export const publicEnv = {
  get NEXT_PUBLIC_SITE_URL(): string {
    return parseEnvVar('NEXT_PUBLIC_SITE_URL', siteUrl, process.env.NEXT_PUBLIC_SITE_URL)
  },
  get NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY(): string {
    return parseEnvVar(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      nonEmpty,
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    )
  },
}

export function assertPublicEnv(): void {
  void publicEnv.NEXT_PUBLIC_SITE_URL
  void publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
}
