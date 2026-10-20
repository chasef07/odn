import Link from 'next/link'
import { AgentChat } from '@/components/admin/AgentChat'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { requireAdminSession } from '@/lib/admin-session'
import { isAgentConfigured } from '@/lib/agent/model'

export const dynamic = 'force-dynamic'

export default async function AdminAgentPage() {
  const admin = await requireAdminSession()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary rounded px-2 py-1 text-sm font-medium">
                Admin Portal
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-gray-600 sm:block">{admin.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <AgentChat configured={isAgentConfigured()} />
      </main>
    </div>
  )
}
