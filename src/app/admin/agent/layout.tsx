import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { listAgentThreads } from '@/db/agent-threads'
import { customerTotals, isAnalyticsConfigured, notesSplit } from '@/db/analytics-query'
import { AgentThreadList } from '@/components/admin/AgentThreadList'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { RepeatCustomerPanel } from '@/components/admin/RepeatCustomerPanel'
import { requireAdminSession } from '@/lib/admin-session'
import { todayET } from '@/lib/dates'

async function RepeatCustomers() {
  const today = todayET()
  const [totals, day, month] = await Promise.all([
    customerTotals(),
    notesSplit('day', today),
    notesSplit('month', today),
  ])
  return <RepeatCustomerPanel totals={totals} splits={{ day, month }} />
}

function RepeatCustomersLoading() {
  return (
    <div aria-hidden className="mb-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <div key={card} className="bg-muted h-[5.5rem] animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="bg-muted h-80 animate-pulse rounded-xl" />
    </div>
  )
}

export default async function AdminAgentLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminSession()
  const threads = await listAgentThreads(admin.doctorId)

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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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

        {isAnalyticsConfigured() && (
          <Suspense fallback={<RepeatCustomersLoading />}>
            <RepeatCustomers />
          </Suspense>
        )}
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <AgentThreadList threads={threads} />
          {children}
        </div>
      </main>
    </div>
  )
}
