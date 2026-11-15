import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminStats } from '@/components/admin/AdminStats'

function pendingLink(pendingCount: number): Element | null {
  const { container } = render(
    <AdminStats pendingCount={pendingCount} approvedToday={0} deniedToday={0} />
  )
  return container.querySelector('a[href="/admin/pending"]')
}

describe('AdminStats', () => {
  it('links to the pending list when reviews are waiting', () => {
    expect(pendingLink(3)).toHaveTextContent('View')
  })

  it('shows no pending link when nothing is waiting', () => {
    expect(pendingLink(0)).toBeNull()
  })
})
