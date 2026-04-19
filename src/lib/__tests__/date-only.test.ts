import { describe, expect, it } from 'vitest'
import {
  isAtLeastAge,
  isIsoDateOnlyInSaneRange,
  parseIsoDateOnly,
  parseIsoDateOnlyAsUTCDate,
} from '../date-only'

describe('date-only helpers', () => {
  it('parses valid ISO date-only strings without timezone drift', () => {
    expect(parseIsoDateOnly('2026-04-20')).toEqual({
      year: 2026,
      month: 4,
      day: 20,
    })

    const parsedDate = parseIsoDateOnlyAsUTCDate('2026-04-20')
    expect(parsedDate?.toISOString()).toBe('2026-04-20T00:00:00.000Z')
  })

  it('rejects malformed or impossible calendar dates', () => {
    expect(parseIsoDateOnly('2026-02-30')).toBeNull()
    expect(parseIsoDateOnly('04/20/2026')).toBeNull()
    expect(parseIsoDateOnly('')).toBeNull()
  })

  it('treats tomorrow as out of range using a deterministic UTC calendar date', () => {
    const lateUtcDay = new Date('2026-04-19T23:30:00Z')

    expect(isIsoDateOnlyInSaneRange('2026-04-20', { now: lateUtcDay })).toBe(false)
    expect(isIsoDateOnlyInSaneRange('2026-04-19', { now: lateUtcDay })).toBe(true)
  })

  it('does not age a patient up until their actual UTC birthday boundary', () => {
    const lateUtcDay = new Date('2026-04-19T23:30:00Z')

    expect(isAtLeastAge('2008-04-20', 18, lateUtcDay)).toBe(false)
    expect(isAtLeastAge('2008-04-19', 18, lateUtcDay)).toBe(true)
  })
})
