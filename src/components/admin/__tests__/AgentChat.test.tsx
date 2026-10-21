import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentUIMessage } from '@/lib/agent/tools'

const { chat } = vi.hoisted(() => ({
  chat: {
    messages: [] as unknown[],
    status: 'ready' as string,
    error: undefined as Error | undefined,
    sendMessage: vi.fn(),
    stop: vi.fn(),
  },
}))

vi.mock('@ai-sdk/react', () => ({ useChat: () => chat }))

import { AgentChat } from '../AgentChat'

const SQL = 'select i from generate_series(1, 150) as i'

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
    render(<AgentChat configured={false} />)

    expect(screen.getByText('The data agent is not configured')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('sends a starter question when it is clicked', async () => {
    render(<AgentChat configured />)

    await userEvent.click(screen.getByRole('button', { name: 'Approval rate by state' }))

    expect(chat.sendMessage).toHaveBeenCalledWith({ text: 'Approval rate by state' })
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

    render(<AgentChat configured />)

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

    render(<AgentChat configured />)

    expect(screen.getByText('Working')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides the working line once the answer streams', () => {
    chat.status = 'streaming'
    chat.messages = [assistant([{ type: 'text', text: '41 notes.' }])]

    render(<AgentChat configured />)

    expect(screen.getByText('41 notes.')).toBeInTheDocument()
    expect(screen.queryByText('Working')).not.toBeInTheDocument()
  })

  it('locks the input while streaming and stops on request', async () => {
    chat.status = 'streaming'
    chat.messages = [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Notes per month' }] }]

    render(<AgentChat configured />)

    expect(screen.getByRole('textbox', { name: 'Question' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(chat.stop).toHaveBeenCalled()
  })
})
