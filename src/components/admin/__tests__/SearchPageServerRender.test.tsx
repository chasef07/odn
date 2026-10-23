import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SearchPage } from '@/components/admin/SearchPage'
import type { SearchSubmission } from '@/app/admin/_actions/search'
import { SubmissionStatus } from '@/db/types'
import type { DateOnly } from '@/lib/dates'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

const result: SearchSubmission = {
  id: '5bfaa65d-6cf1-4532-a19c-a841f9968db7',
  patientFirstName: 'Jane',
  patientLastName: 'Doe',
  email: 'jane@example.com',
  status: SubmissionStatus.APPROVED,
  notePurpose: 'work',
  firstDayOff: '2026-10-23' as DateOnly,
  lastDayOff: '2026-10-23' as DateOnly,
  createdAt: new Date('2026-10-23T16:34:21Z'),
}

function serverSelectValue(html: string): string | undefined {
  return html.match(/data-slot="select-value"[^>]*>([^<]*)</)?.[1]
}

describe('SearchPage server render', () => {
  it.each([
    ['name', 'Name'],
    ['medicalRecord', 'Medical Record #'],
  ] as const)(
    'renders the %s search type label in the server HTML, so hydration matches',
    (searchType, label) => {
      const html = renderToString(<SearchPage initialSearchType={searchType} />)

      expect(serverSelectValue(html)).toBe(label)
    }
  )

  it('hydrates a page of results without a mismatch', async () => {
    const page = (
      <SearchPage
        initialQuery="Jane"
        initialSearchType="name"
        initialResults={[result]}
        initialTotal={1}
      />
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(page)
    document.body.appendChild(container)
    const recoverable: unknown[] = []

    await act(async () => {
      hydrateRoot(container, page, { onRecoverableError: (error) => recoverable.push(error) })
    })

    expect(recoverable).toEqual([])
    container.remove()
  })

  it('keeps the result card link and the email link side by side, never nested', () => {
    const container = document.createElement('div')
    container.innerHTML = renderToString(
      <SearchPage initialQuery="Jane" initialResults={[result]} initialTotal={1} />
    )

    expect(container.querySelectorAll(`a[href="/admin/search/${result.id}"]`)).toHaveLength(2)
    expect(container.querySelectorAll('a[href="mailto:jane@example.com"]')).toHaveLength(2)
  })
})
