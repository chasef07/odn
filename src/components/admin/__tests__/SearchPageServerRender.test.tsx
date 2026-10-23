import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SearchPage } from '@/components/admin/SearchPage'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

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
})
