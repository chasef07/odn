import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentUIMessage } from '@/lib/agent/tools'

const { chat, useChat, refresh } = vi.hoisted(() => {
  const chat = {
    messages: [] as unknown[],
    status: 'ready' as string,
    error: undefined as Error | undefined,
    sendMessage: vi.fn(),
    stop: vi.fn(),
  }
  return { chat, useChat: vi.fn(() => chat), refresh: vi.fn() }
})

vi.mock('@ai-sdk/react', () => ({ useChat }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { AgentChat } from '../AgentChat'

const SQL = 'select i from generate_series(1, 150) as i'

const THREAD_ID = '0b9a4d8e-2f43-4c1e-9d55-7a1f3c2b6e10'

function renderChat(configured = true, initialMessages: AgentUIMessage[] = []) {
  return render(
    <AgentChat configured={configured} threadId={THREAD_ID} initialMessages={initialMessages} />
  )
}

function assistant(parts: AgentUIMessage['parts']): AgentUIMessage {
  return { id: 'a1', role: 'assistant', parts }
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  chat.messages = []
  chat.status = 'ready'
  chat.error = undefined
})

describe('AgentChat', () => {
  it('says the agent is not configured and offers no input', () => {
    renderChat(false)

    expect(screen.getByText('The data agent is not configured')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('opens the thread with its stored messages, sends only the new message, and refreshes the thread list when an answer finishes', async () => {
    const stored: AgentUIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Notes per month' }] },
    ]

    renderChat(true, stored)

    const options = (useChat.mock.lastCall as unknown[] | undefined)?.[0] as {
      id: string
      messages: AgentUIMessage[]
      transport: { prepareSendMessagesRequest: (request: object) => { body: object } }
      onFinish: () => void
    }
    expect(options.id).toBe(THREAD_ID)
    expect(options.messages).toBe(stored)
    const next = { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'And by state?' }] }
    expect(
      options.transport.prepareSendMessagesRequest({ id: THREAD_ID, messages: [...stored, next] })
        .body
    ).toEqual({ id: THREAD_ID, message: next })
    options.onFinish()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('sends a starter question when it is clicked', async () => {
    renderChat()

    await userEvent.click(screen.getByRole('button', { name: 'Approval rate by state' }))

    expect(chat.sendMessage).toHaveBeenCalledWith({ text: 'Approval rate by state' })
  })

  it('offers the funnel drop-off by channel as a starter question', async () => {
    renderChat()
    const question = 'Chart funnel drop-off by step and acquisition channel, last 7 days'

    await userEvent.click(screen.getByRole('button', { name: question }))

    expect(chat.sendMessage).toHaveBeenCalledWith({ text: question })
  })

  it('shows only the final answer and the chart, not the SQL, the rows or the narration', () => {
    chat.messages = [
      assistant([
        { type: 'text', text: 'Let me look that up.' },
        {
          type: 'tool-query',
          toolCallId: 'c1',
          state: 'output-available',
          input: { sql: SQL },
          output: { columns: ['i'], rows: [{ i: 41 }], truncated: false },
        },
        {
          type: 'tool-chart',
          toolCallId: 'c2',
          state: 'output-available',
          input: { sql: SQL, kind: 'bar', title: 'Notes', x: 'month', series: [] },
          output: {
            kind: 'bar',
            title: 'Notes by month',
            x: 'month',
            series: [{ column: 'notes', label: 'Notes', format: 'number' }],
            rows: [{ month: '2026-09', notes: 41 }],
            truncated: false,
          },
        },
        { type: 'text', text: '41 notes in September 2026.' },
      ]),
    ]

    renderChat()

    expect(screen.getByText('41 notes in September 2026.')).toBeInTheDocument()
    expect(screen.getByText('Notes by month')).toBeInTheDocument()
    expect(screen.queryByText('Let me look that up.')).not.toBeInTheDocument()
    expect(screen.queryByText(SQL)).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows one working line while a tool runs and hides a failed tool call', () => {
    chat.status = 'streaming'
    chat.messages = [
      assistant([
        {
          type: 'tool-chart',
          toolCallId: 'c1',
          state: 'output-error',
          input: {
            sql: SQL,
            kind: 'bar',
            title: 'Notes',
            x: 'month',
            series: [{ column: 'notes', label: 'Notes', format: 'number' }],
          },
          errorText: 'The SQL does not return month. It returns: i.',
        },
        {
          type: 'tool-query',
          toolCallId: 'c2',
          state: 'input-available',
          input: { sql: SQL },
        },
      ]),
    ]

    renderChat()

    expect(screen.getByText('Working')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the working line as soon as a question is sent', () => {
    chat.status = 'submitted'
    chat.messages = [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Notes per month' }] }]

    renderChat()

    expect(screen.getByText('Working')).toBeInTheDocument()
  })

  it('hides the working line once the answer streams', () => {
    chat.status = 'streaming'
    chat.messages = [assistant([{ type: 'text', text: '41 notes.' }])]

    renderChat()

    expect(screen.getByText('41 notes.')).toBeInTheDocument()
    expect(screen.queryByText('Working')).not.toBeInTheDocument()
  })

  it('locks the input while streaming and stops on request', async () => {
    chat.status = 'streaming'
    chat.messages = [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Notes per month' }] }]

    renderChat()

    expect(screen.getByRole('textbox', { name: 'Question' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(chat.stop).toHaveBeenCalled()
  })
})
