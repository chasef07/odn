import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { params } = vi.hoisted(() => ({ params: { current: {} as { threadId?: string } } }))

vi.mock('next/navigation', () => ({ useParams: () => params.current }))

import { AgentThreadList } from '../AgentThreadList'

const threads = [
  { id: 'thread-a', title: 'Notes sold per month', updatedAt: new Date('2026-10-29T16:05:00Z') },
  { id: 'thread-b', title: 'Refund rate by channel', updatedAt: new Date('2026-10-28T13:00:00Z') },
]

beforeEach(() => {
  params.current = {}
})

describe('AgentThreadList', () => {
  it('links each thread with its title and last update in New York time', () => {
    render(<AgentThreadList threads={threads} />)

    const link = screen.getByRole('link', { name: /Notes sold per month/ })
    expect(link).toHaveAttribute('href', '/admin/agent/thread-a')
    expect(link).toHaveTextContent('Oct 29, 12:05 PM EDT')
    expect(screen.getByRole('link', { name: /Refund rate by channel/ })).toHaveAttribute(
      'href',
      '/admin/agent/thread-b'
    )
    expect(screen.getByRole('link', { name: 'New chat' })).toHaveAttribute('href', '/admin/agent')
  })

  it('marks only the thread in the URL as the current page', () => {
    params.current = { threadId: 'thread-b' }

    render(<AgentThreadList threads={threads} />)

    expect(screen.getByRole('link', { name: /Refund rate by channel/ })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', { name: /Notes sold per month/ })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('says there are no past threads yet when the list is empty', () => {
    render(<AgentThreadList threads={[]} />)

    expect(screen.getByText('No past threads yet.')).toBeInTheDocument()
  })
})
