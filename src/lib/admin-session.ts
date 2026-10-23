import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAllowlistedAdmin } from '@/lib/admin-allowlist'
import { auth } from '@/lib/auth'

export type AdminSession = { doctorId: string; email: string }

export async function findAdminSession(requestHeaders: Headers): Promise<AdminSession | null> {
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user || !isAllowlistedAdmin(session.user)) return null
  return { doctorId: session.user.id, email: session.user.email }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const admin = await findAdminSession(await headers())
  if (!admin) redirect('/admin/login')
  return admin
}

export function adminAction<Args extends unknown[], Result>(
  action: (admin: AdminSession, ...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result> {
  return async (...args) => action(await requireAdminSession(), ...args)
}
