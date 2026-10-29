'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { AgentThreadSummary } from '@/db/types'
import { Button } from '@/components/ui/button'
import { formatInstantET, instantOf } from '@/lib/dates'
import { cn } from '@/lib/utils'

export function AgentThreadList({ threads }: { threads: AgentThreadSummary[] }) {
  const { threadId } = useParams<{ threadId?: string }>()
  return (
    <aside className="flex flex-col rounded-lg border bg-white lg:h-[calc(100vh-13rem)] lg:min-h-[32rem]">
      <div className="border-b p-3">
        <Button asChild variant="outline" className="w-full">
          <Link href="/admin/agent" prefetch={false}>
            <Plus className="size-4" />
            New chat
          </Link>
        </Button>
      </div>
      <nav
        aria-label="Past threads"
        className="max-h-48 overflow-y-auto p-2 lg:max-h-none lg:flex-1"
      >
        {threads.length === 0 ? (
          <p className="text-muted-foreground px-2 py-1 text-sm">No past threads yet.</p>
        ) : (
          <ul className="space-y-1">
            {threads.map((thread) => {
              const active = thread.id === threadId
              return (
                <li key={thread.id}>
                  <Link
                    href={`/admin/agent/${thread.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'hover:bg-muted block rounded-md px-2 py-2 text-sm',
                      active && 'bg-muted font-medium'
                    )}
                  >
                    <span className="block truncate">{thread.title}</span>
                    <span className="text-muted-foreground block text-xs font-normal">
                      {formatInstantET(instantOf(thread.updatedAt), { includeYear: false })}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </aside>
  )
}
