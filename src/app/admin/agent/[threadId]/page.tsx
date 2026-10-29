import { notFound } from 'next/navigation'
import { z } from 'zod'
import { findAgentThread } from '@/db/agent-threads'
import { AgentChat } from '@/components/admin/AgentChat'
import { requireAdminSession } from '@/lib/admin-session'
import { isAgentConfigured } from '@/lib/agent/model'
import { storedMessages } from '@/lib/agent/threads'
import { agentTools } from '@/lib/agent/tools'

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
  const messages = await storedMessages(thread, agentTools({ adminEmail: admin.email }))

  return (
    <AgentChat
      key={threadId}
      configured={isAgentConfigured()}
      threadId={threadId}
      initialMessages={messages}
    />
  )
}
