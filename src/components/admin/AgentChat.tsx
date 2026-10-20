'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
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
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool'
import { AgentChart } from '@/components/admin/AgentChart'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type { AnalyticsResult } from '@/db/analytics-query'
import type { AgentUIMessage } from '@/lib/agent/tools'

export const STARTER_QUESTIONS = [
  'Notes sold per month this year',
  'Approval rate by state',
  'Refund rate by acquisition channel',
] as const

const RENDERED_ROW_LIMIT = 100

type Part = AgentUIMessage['parts'][number]
type QueryPart = Extract<Part, { type: 'tool-query' }>
type ChartPart = Extract<Part, { type: 'tool-chart' }>

function Running() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-sm">
      <LoaderCircle className="size-4 animate-spin" />
      Running query
    </div>
  )
}

function ToolError({ text }: { text: string }) {
  return (
    <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
      {text}
    </p>
  )
}

function Sql({ part, title }: { part: QueryPart | ChartPart; title: string }) {
  return (
    <Tool>
      <ToolHeader type={part.type} state={part.state} title={title} />
      <ToolContent>
        <pre className="bg-muted/50 overflow-x-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
          {part.input?.sql}
        </pre>
      </ToolContent>
    </Tool>
  )
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ResultTable({ result }: { result: AnalyticsResult }) {
  const shown = result.rows.slice(0, RENDERED_ROW_LIMIT)
  return (
    <div className="space-y-2">
      <div className="max-h-96 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {result.columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row, index) => (
              <TableRow key={index}>
                {result.columns.map((column) => (
                  <TableCell key={column}>{cellText(row[column])}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">
        {shown.length < result.rows.length
          ? `Showing ${shown.length} of ${result.rows.length} rows.`
          : `${result.rows.length} ${result.rows.length === 1 ? 'row' : 'rows'}.`}
        {result.truncated && ' The query returned more than 500 rows, so the result was cut off.'}
      </p>
    </div>
  )
}

function ToolPartView({ part }: { part: QueryPart | ChartPart }) {
  const title = part.type === 'tool-chart' ? (part.input?.title ?? 'Chart') : 'Query'
  return (
    <div className="w-full space-y-3">
      <Sql part={part} title={title} />
      {(part.state === 'input-streaming' || part.state === 'input-available') && <Running />}
      {part.state === 'output-error' && <ToolError text={part.errorText} />}
      {part.state === 'output-available' &&
        (part.type === 'tool-chart' ? (
          <AgentChart chart={part.output} />
        ) : (
          <ResultTable result={part.output} />
        ))}
    </div>
  )
}

function PartView({ part }: { part: Part }) {
  if (part.type === 'text') return <MessageResponse>{part.text}</MessageResponse>
  if (part.type === 'tool-query' || part.type === 'tool-chart') return <ToolPartView part={part} />
  return null
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

function Chat() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, stop, error } = useChat<AgentUIMessage>({
    transport: new DefaultChatTransport({ api: '/api/admin/agent' }),
  })
  const busy = status === 'submitted' || status === 'streaming'

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
                  Questions run as read-only SQL over orders, refunds, acquisition and SMS support.
                  No patient names or contact details are available.
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
                  {message.parts.map((part, index) => (
                    <PartView key={index} part={part} />
                  ))}
                </MessageContent>
              </Message>
            ))
          )}
          {status === 'submitted' && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              Thinking
            </div>
          )}
          {error && <ToolError text={`The request failed: ${error.message}`} />}
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

export function AgentChat({ configured }: { configured: boolean }) {
  return configured ? <Chat /> : <NotConfigured />
}
