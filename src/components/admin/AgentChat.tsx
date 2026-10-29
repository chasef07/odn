'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowUp, Database, LoaderCircle, Square } from 'lucide-react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { AgentChart } from '@/components/admin/AgentChart'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AgentUIMessage } from '@/lib/agent/tools'

export const STARTER_QUESTIONS = [
  'Notes sold per month this year',
  'Approval rate by state',
  'Refund rate by acquisition channel',
  'Chart funnel drop-off by step and acquisition channel, last 7 days',
] as const

type Part = AgentUIMessage['parts'][number]

function ErrorText({ text }: { text: string }) {
  return (
    <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
      {text}
    </p>
  )
}

function isToolPart(part: Part): boolean {
  return part.type === 'tool-query' || part.type === 'tool-chart'
}

function MessageParts({ parts }: { parts: Part[] }) {
  const lastTool = parts.findLastIndex(isToolPart)
  return parts.map((part, index) => {
    if (part.type === 'text' && index > lastTool) {
      return <MessageResponse key={index}>{part.text}</MessageResponse>
    }
    if (part.type === 'tool-chart' && part.state === 'output-available') {
      return <AgentChart key={index} chart={part.output} />
    }
    return null
  })
}

function NotConfigured() {
  return (
    <div className="rounded-lg border bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">The data agent is not configured</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Set TELNYX_INFERENCE_API_KEY and ANALYTICS_DATABASE_URL for this environment to turn it on.
      </p>
    </div>
  )
}

function Chat({ threadId, initialMessages }: ChatProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, stop, error } = useChat<AgentUIMessage>({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/admin/agent',
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: { id, message: messages.at(-1) },
      }),
    }),
    onFinish: () => router.refresh(),
  })
  const busy = status === 'submitted' || status === 'streaming'
  const working =
    status === 'submitted' ||
    (status === 'streaming' && messages.at(-1)?.parts.at(-1)?.type !== 'text')

  function ask(text: string) {
    const question = text.trim()
    if (!question || busy) return
    void sendMessage({ text: question })
    setInput('')
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    ask(input)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      ask(input)
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[32rem] flex-col rounded-lg border bg-white">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <Database className="text-muted-foreground size-8" />
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Ask about the business</h3>
                <p className="text-muted-foreground text-sm">
                  Questions run as read-only SQL over orders, refunds, acquisition, the order funnel
                  and SMS support. No patient names or contact details are available.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTER_QUESTIONS.map((question) => (
                  <Button
                    key={question}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => ask(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent className="group-[.is-assistant]:w-full">
                  <MessageParts parts={message.parts} />
                </MessageContent>
              </Message>
            ))
          )}
          {working && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              Working
            </div>
          )}
          {error && <ErrorText text={`The request failed: ${error.message}`} />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question about orders, refunds or support"
          aria-label="Question"
          disabled={busy}
          className="max-h-40 min-h-10 resize-none"
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => void stop()}>
            <Square className="size-4" />
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            <ArrowUp className="size-4" />
            Ask
          </Button>
        )}
      </form>
    </div>
  )
}

type ChatProps = { threadId: string; initialMessages: AgentUIMessage[] }

export function AgentChat({ configured, ...chat }: ChatProps & { configured: boolean }) {
  return configured ? <Chat {...chat} /> : <NotConfigured />
}
