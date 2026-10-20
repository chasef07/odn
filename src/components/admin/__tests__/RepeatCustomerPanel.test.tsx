import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotesSplit } from '@/db/analytics-query'
import type { DateOnly } from '@/lib/dates'
import { RepeatCustomerPanel } from '../RepeatCustomerPanel'

function split(start: string, label: string, newNotes: number, returningNotes: number): NotesSplit {
  return { start: start as DateOnly, label, newNotes, returningNotes }
}

const props = {
  totals: { totalNotes: 42000, uniqueCustomers: 30000, repeatCustomers: 5400 },
  splits: {
    day: [split('2026-10-19', 'Oct 19', 300, 200), split('2026-10-20', 'Oct 20', 350, 150)],
    month: [split('2026-09-01', 'Sep 2026', 6000, 3000), split('2026-10-01', 'Oct 2026', 700, 300)],
  },
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
})

describe('RepeatCustomerPanel', () => {
  it('shows all-time notes, unique customers and the share who came back', () => {
    render(<RepeatCustomerPanel {...props} />)

    expect(screen.getByText('42,000')).toBeInTheDocument()
    expect(screen.getByText('30,000')).toBeInTheDocument()
    expect(screen.getByText('18%')).toBeInTheDocument()
    expect(screen.getByText('5,400 of 30,000 came back')).toBeInTheDocument()
  })

  it('splits this month by default and today after switching to Day', async () => {
    render(<RepeatCustomerPanel {...props} />)

    expect(
      screen.getByText('This month: 1,000 notes, 700 brand new, 300 returning (30%)')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Day' }))

    expect(
      screen.getByText('Today: 500 notes, 350 brand new, 150 returning (30%)')
    ).toBeInTheDocument()
  })

  it('shows 0% instead of dividing by zero before any customer', () => {
    render(
      <RepeatCustomerPanel
        totals={{ totalNotes: 0, uniqueCustomers: 0, repeatCustomers: 0 }}
        splits={{ day: [split('2026-10-20', 'Oct 20', 0, 0)], month: [] }}
      />
    )

    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
