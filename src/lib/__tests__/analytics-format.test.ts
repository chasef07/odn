import { describe, expect, it } from 'vitest'
import { formatShortDate } from '@/lib/analytics-format'

describe('formatShortDate', () => {
  it('shows the UTC day of an ISO timestamp', () => {
    expect(formatShortDate('2026-10-17T03:30:00.000Z')).toBe('Oct 17, 2026')
    expect(formatShortDate('2026-09-30T23:59:59.999Z')).toBe('Sep 30, 2026')
  })

  it('shows a dash for a missing timestamp', () => {
    expect(formatShortDate(null)).toBe('—')
  })
})
