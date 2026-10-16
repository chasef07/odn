import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export type AdminSession = { doctorId: string; email: string }

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/admin/login')
  return { doctorId: session.user.id, email: session.user.email }
}

export function adminAction<Args extends unknown[], Result>(
  action: (admin: AdminSession, ...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result> {
  return async (...args) => action(await requireAdminSession(), ...args)
}
