import { validateUIMessages } from 'ai'
import type { AgentThread } from '@/db/types'
import type { agentTools, AgentUIMessage } from './tools'

export const TITLE_LENGTH = 80

export function threadTitle(messages: AgentUIMessage[]): string {
  const text = (messages[0]?.parts ?? [])
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > TITLE_LENGTH ? `${text.slice(0, TITLE_LENGTH - 1)}…` : text
}

export async function storedMessages(
  thread: AgentThread | null,
  tools: ReturnType<typeof agentTools>
): Promise<AgentUIMessage[]> {
  if (!thread) return []
  return validateUIMessages<AgentUIMessage>({ messages: thread.messages, tools })
}
