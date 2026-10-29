import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { requireAdminSession } from '@/lib/admin-session'

export const dynamic = 'force-dynamic'

export default async function NewAgentThreadPage() {
  await requireAdminSession()
  redirect(`/admin/agent/${randomUUID()}`)
}
