import { env } from '@/lib/env'

export function isAllowlistedAdmin(user: {
  email?: string | null
  emailVerified?: boolean | null
}): boolean {
  return (
    user.emailVerified === true &&
    typeof user.email === 'string' &&
    env.ADMIN_EMAILS.includes(user.email.toLowerCase())
  )
}
