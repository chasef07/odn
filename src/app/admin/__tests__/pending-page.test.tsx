import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pendingSubmission } from './pending-fixtures'

const getSubmissionsForReview = vi.fn()

vi.mock('@/lib/admin-session', () => ({
  requireAdminSession: vi.fn(async () => ({ id: 'admin-1', email: 'admin@example.com' })),
}))

vi.mock('@/app/admin/_actions/queues', () => ({
  getSubmissionsForReview: () => getSubmissionsForReview(),
}))

vi.mock('@/components/admin/LogoutButton', () => ({
  LogoutButton: () => null,
}))

const { default: PendingSubmissionsPage } = await import('@/app/admin/pending/page')

async function render(): Promise<HTMLElement> {
  const container = document.createElement('div')
  container.innerHTML = renderToString(await PendingSubmissionsPage())
  return container
}

describe('pending submissions page', () => {
  beforeEach(() => {
    getSubmissionsForReview.mockReset()
  })

  it('lists every pending submission in queue order, each opening the review view on it', async () => {
    getSubmissionsForReview.mockResolvedValue({
      success: true,
      data: [
        pendingSubmission({ id: 'oldest', patientFirstName: 'Ann', patientLastName: 'Old' }),
        pendingSubmission({ id: 'newest', patientFirstName: 'Bo', patientLastName: 'New' }),
      ],
    })

    const page = await render()

    expect(page.textContent).toContain('2 pending reviews')
    const rows = [...page.querySelectorAll('tbody tr')]
    expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual(['Ann Old', 'Bo New'])
    expect(
      rows.map((row) => row.querySelector('a[href^="/admin/review"]')?.getAttribute('href'))
    ).toEqual(['/admin/review?id=oldest', '/admin/review?id=newest'])
    expect(rows[0].textContent).toContain('Nov 13-14, 2026')
  })

  it('says so when nothing is pending', async () => {
    getSubmissionsForReview.mockResolvedValue({ success: true, data: [] })

    const page = await render()

    expect(page.textContent).toContain('No pending reviews')
    expect(page.querySelector('table')).toBeNull()
  })

  it('shows the failure instead of an empty list when the queue fails to load', async () => {
    getSubmissionsForReview.mockResolvedValue({ success: false, error: 'boom' })

    const page = await render()

    expect(page.textContent).toContain('Failed to load pending submissions')
    expect(page.textContent).not.toContain('No pending reviews')
  })
})
