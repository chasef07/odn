import { render, screen, within } from '@testing-library/react'
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

  it('renders at most 100 rows of a query result and says how many there were and that it was cut off', () => {
    const rows = Array.from({ length: 150 }, (_, index) => ({ i: index + 1 }))
    chat.messages = [
      assistant([
        {
          type: 'tool-query',
          toolCallId: 'c1',
          state: 'output-available',
          input: { sql: SQL },
          output: { columns: ['i'], rows, truncated: true },
        },
      ]),
    ]

    render(<AgentChat configured />)

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(101)
    expect(within(table).getByText('100')).toBeInTheDocument()
    expect(within(table).queryByText('101')).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Showing 100 of 150 rows. The query returned more than 500 rows, so the result was cut off.'
      )
    ).toBeInTheDocument()
  })

  it('shows a running query, then the error text of a failed one', () => {
    chat.messages = [
      assistant([
        {
          type: 'tool-query',
          toolCallId: 'c1',
          state: 'input-available',
          input: { sql: SQL },
        },
        {
          type: 'tool-chart',
          toolCallId: 'c2',
          state: 'output-error',
          input: { sql: SQL, kind: 'bar', title: 'Notes', x: 'month', y: ['notes'] },
          errorText: 'The SQL does not return month. It returns: i.',
        },
      ]),
    ]

    render(<AgentChat configured />)

    expect(screen.getByText('Running query')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The SQL does not return month. It returns: i.'
    )
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
