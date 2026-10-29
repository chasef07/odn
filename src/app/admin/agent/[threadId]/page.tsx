import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { findAgentThread, listAgentThreads } from '@/db/agent-threads'
import { customerTotals, isAnalyticsConfigured, notesSplit } from '@/db/analytics-query'
import { AgentChat } from '@/components/admin/AgentChat'
import { AgentThreadList } from '@/components/admin/AgentThreadList'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { RepeatCustomerPanel } from '@/components/admin/RepeatCustomerPanel'
import { requireAdminSession } from '@/lib/admin-session'
import { isAgentConfigured } from '@/lib/agent/model'
import { storedMessages } from '@/lib/agent/threads'
import { agentTools } from '@/lib/agent/tools'
import { todayET } from '@/lib/dates'

async function repeatCustomerData() {
  if (!isAnalyticsConfigured()) return null
  const today = todayET()
  const [totals, day, month] = await Promise.all([
    customerTotals(),
    notesSplit('day', today),
    notesSplit('month', today),
  ])
  return { totals, splits: { day, month } }
}

export const dynamic = 'force-dynamic'

export default async function AdminAgentThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>
}) {
  const { threadId } = await params
  const admin = await requireAdminSession()
  if (!z.uuid().safeParse(threadId).success) notFound()

  const thread = await findAgentThread(threadId)
  if (thread && thread.adminUserId !== admin.doctorId) notFound()

  const [repeatCustomers, threads, messages] = await Promise.all([
    repeatCustomerData(),
    listAgentThreads(admin.doctorId),
    storedMessages(thread, agentTools({ adminEmail: admin.email })),
  ])

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

        {repeatCustomers && <RepeatCustomerPanel {...repeatCustomers} />}
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <AgentThreadList threads={threads} activeId={threadId} />
          <AgentChat
            key={threadId}
            configured={isAgentConfigured()}
            threadId={threadId}
            initialMessages={messages}
          />
        </div>
      </main>
    </div>
  )
}
