import { z } from 'zod'
import { parseEnvVar } from '@/lib/public-env'

const nonEmpty = z.string().trim().min(1)
const priceId = nonEmpty.startsWith('price_', 'must start with "price_"')
const origin = z
  .url({ protocol: /^https?$/ })
  .refine((value) => {
    const url = new URL(value)
    return !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
  }, 'must be an HTTP(S) origin without a path')
  .transform((value) => new URL(value).origin)

const switchFlag = z.enum(['true', 'false']).transform((value) => value === 'true')

const schema = {
  DATABASE_URL: nonEmpty,
  STRIPE_SECRET_KEY: nonEmpty,
  STRIPE_WEBHOOK_SECRET: nonEmpty,
  STRIPE_PRICE_ID: priceId,
  STRIPE_FRIENDS_FAMILY_PRICE_ID: priceId.optional(),
  STRIPE_DOCTOR_10_PRICE_ID: priceId.optional(),
  CRON_SECRET: nonEmpty,
  BETTER_AUTH_SECRET: nonEmpty,
  BETTER_AUTH_URL: z.url(),
  RESEND_API_KEY: nonEmpty,
  RESEND_WEBHOOK_SECRET: nonEmpty,
  RESEND_FROM_EMAIL: nonEmpty,
  DOCTOR_NAME: nonEmpty,
  DOCTOR_CREDENTIALS: nonEmpty,
  DOCTOR_SIGNATURE_URL: nonEmpty,
  DOCTOR_NPI: nonEmpty.default('1558307702'),
  VERIFICATION_BASE_URL: origin,
  TELNYX_SMS_ENABLED: switchFlag,
  TELNYX_API_KEY: nonEmpty.optional(),
  TELNYX_FROM_NUMBER: nonEmpty.optional(),
  TELNYX_PUBLIC_KEY: nonEmpty.optional(),
  TELNYX_WEBHOOK_ENABLED: switchFlag.default(true),
  INTAKE_VALIDATION_ENFORCED: switchFlag.default(false),
} satisfies Record<string, z.ZodType>

type Schema = typeof schema
type EnvName = keyof Schema
export type ServerEnv = { readonly [K in EnvName]: z.output<Schema[K]> }

const names = Object.keys(schema) as EnvName[]

function read<K extends EnvName>(name: K): ServerEnv[K] {
  const fieldSchema: z.ZodType = schema[name]
  return parseEnvVar(name, fieldSchema, process.env[name]) as ServerEnv[K]
}

export const env = Object.defineProperties(
  {},
  Object.fromEntries(names.map((name) => [name, { enumerable: true, get: () => read(name) }]))
) as ServerEnv

export function telnyxSmsSender(): { apiKey: string; from: string } | null {
  if (!env.TELNYX_SMS_ENABLED) return null
  const apiKey = env.TELNYX_API_KEY
  const from = env.TELNYX_FROM_NUMBER
  if (!apiKey || !from) {
    throw new Error(
      'TELNYX_SMS_ENABLED is true, so TELNYX_API_KEY and TELNYX_FROM_NUMBER must be set'
    )
  }
  return { apiKey, from }
}

const checks: (() => unknown)[] = [
  ...names.filter((name) => name !== 'TELNYX_SMS_ENABLED').map((name) => () => read(name)),
  telnyxSmsSender,
]

export function serverEnvProblems(): string[] {
  return checks.flatMap((check) => {
    try {
      check()
      return []
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)]
    }
  })
}

export function exitOnInvalidServerEnv(): void {
  const problems = serverEnvProblems()
  if (problems.length === 0) return
  console.error(`Invalid server configuration:\n${problems.join('\n')}`)
  process.exit(1)
}
