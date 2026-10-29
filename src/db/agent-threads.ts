import { db } from './pool'
import { json, sql } from './sql'
import { insert, select, selectAll, set } from './table'
import { agentThreads } from './tables'
import type { AgentThread, AgentThreadSummary } from './types'

export async function listAgentThreads(adminUserId: string): Promise<AgentThreadSummary[]> {
  return db.rows(
    sql`SELECT ${select(agentThreads, ['id', 'title', 'updatedAt'])} FROM agent_threads WHERE admin_user_id = ${adminUserId} ORDER BY updated_at DESC`
  )
}

export async function findAgentThread(id: string): Promise<AgentThread | null> {
  return db.one(sql`SELECT ${selectAll(agentThreads)} FROM agent_threads WHERE id = ${id}`)
}

export async function saveAgentThread({
  id,
  adminUserId,
  title,
  messages,
}: {
  id: string
  adminUserId: string
  title: string
  messages: readonly unknown[]
}): Promise<void> {
  const saved = await db.affected(
    sql`${insert(agentThreads, { id, adminUserId, title, messages: json(messages) })} ON CONFLICT (id) DO UPDATE SET ${set(agentThreads, { messages: json(messages) })} WHERE agent_threads.admin_user_id = ${adminUserId}`
  )
  if (saved === 0) throw new Error(`Agent thread ${id} belongs to another admin`)
}
