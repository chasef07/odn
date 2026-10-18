import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAgeValid } from '../age-validators'
import { PROCESS_TIME_ZONES, useProcessTimeZone } from './process-time-zone'

describe.each(PROCESS_TIME_ZONES)('isAgeValid in a %s runtime', (zone) => {
  useProcessTimeZone(zone)

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-01-15T15:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is 18 on the 18th birthday and 17 the day before', () => {
    expect(isAgeValid('2007-01-15')).toBe(true)
    expect(isAgeValid('2007-01-16')).toBe(false)
    expect(isAgeValid('1925-01-15')).toBe(true)
  })

  it('applies a custom minimum age', () => {
    expect(isAgeValid('2004-01-15', 21)).toBe(true)
    expect(isAgeValid('2004-01-16', 21)).toBe(false)
    expect(isAgeValid('2025-01-15', 0)).toBe(true)
  })

  it('ages a leap-day birthday up on March 1 in a common year', () => {
    vi.setSystemTime(new Date('2026-02-28T15:00:00Z'))
    expect(isAgeValid('2008-02-29')).toBe(false)
    vi.setSystemTime(new Date('2026-03-01T15:00:00Z'))
    expect(isAgeValid('2008-02-29')).toBe(true)
  })

  it('ages a leap-day birthday up on February 29 in a leap year', () => {
    vi.setSystemTime(new Date('2028-02-28T15:00:00Z'))
    expect(isAgeValid('2008-02-29', 20)).toBe(false)
    vi.setSystemTime(new Date('2028-02-29T15:00:00Z'))
    expect(isAgeValid('2008-02-29', 20)).toBe(true)
  })

  it('turns 18 at UTC midnight, whatever the runtime zone', () => {
    vi.setSystemTime(new Date('2025-01-15T23:59:00Z'))
    expect(isAgeValid('2007-01-16')).toBe(false)
    vi.setSystemTime(new Date('2025-01-16T00:00:00Z'))
    expect(isAgeValid('2007-01-16')).toBe(true)
  })

  it('refuses anything that is not a real yyyy-MM-dd day', () => {
    expect(isAgeValid('')).toBe(false)
    expect(isAgeValid('not-a-date')).toBe(false)
    expect(isAgeValid('2000-01-15T00:00:00Z')).toBe(false)
    expect(isAgeValid('2001-02-29')).toBe(false)
  })
})
