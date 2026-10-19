import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonthsUTC,
  currentYearET,
  ageOn,
  businessDayStart,
  dateOnlyFromUtcDate,
  formatDateOnly,
  formatDateOnlyRange,
  formatInstantET,
  inclusiveDayCount,
  instantOf,
  parseDateOnly,
  parseInstant,
  todayET,
  todayInViewerZone,
  todayUTC,
  utcDateFromDateOnly,
  type DateOnly,
} from '../dates'
import { PROCESS_TIME_ZONES, useProcessTimeZone } from './process-time-zone'

function day(value: string): DateOnly {
  const parsed = parseDateOnly(value)
  if (!parsed) throw new Error(`bad fixture ${value}`)
  return parsed
}

function at(iso: string) {
  return instantOf(new Date(iso))
}

describe('parseDateOnly', () => {
  it('accepts real calendar days, leap days included', () => {
    expect(parseDateOnly('2026-10-17')).toBe('2026-10-17')
    expect(parseDateOnly('2024-02-29')).toBe('2024-02-29')
    expect(parseDateOnly('2000-02-29')).toBe('2000-02-29')
  })

  it('accepts years below 100 as written', () => {
    expect(parseDateOnly('0050-02-28')).toBe('0050-02-28')
    expect(parseDateOnly('0004-02-29')).toBe('0004-02-29')
    expect(parseDateOnly('0001-01-01')).toBe('0001-01-01')
    expect(parseDateOnly('0003-02-29')).toBeNull()
    expect(parseDateOnly('0000-01-01')).toBeNull()
  })

  it('rejects impossible days instead of rolling them into the next month', () => {
    expect(parseDateOnly('2023-02-29')).toBeNull()
    expect(parseDateOnly('2100-02-29')).toBeNull()
    expect(parseDateOnly('2026-02-30')).toBeNull()
    expect(parseDateOnly('2026-04-31')).toBeNull()
    expect(parseDateOnly('2026-13-01')).toBeNull()
    expect(parseDateOnly('2026-00-10')).toBeNull()
  })

  it('rejects anything that is not yyyy-MM-dd', () => {
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly('10/17/2026')).toBeNull()
    expect(parseDateOnly('2026-10-17T00:00:00Z')).toBeNull()
    expect(parseDateOnly('2026-1-7')).toBeNull()
    expect(parseDateOnly(' 2026-10-17')).toBeNull()
  })
})

describe.each(PROCESS_TIME_ZONES)('in process time zone %s', (zone) => {
  useProcessTimeZone(zone)

  it('round-trips a database date column without shifting the day', () => {
    const column = new Date('2026-11-01T00:00:00.000Z')
    expect(dateOnlyFromUtcDate(column)).toBe('2026-11-01')
    expect(utcDateFromDateOnly(day('2026-11-01')).toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })

  it('adds days across both DST changes and a leap day', () => {
    expect(addDays(day('2026-03-07'), 2)).toBe('2026-03-09')
    expect(addDays(day('2026-10-31'), 2)).toBe('2026-11-02')
    expect(addDays(day('2024-02-28'), 1)).toBe('2024-02-29')
    expect(addDays(day('2023-02-28'), 1)).toBe('2023-03-01')
    expect(addDays(day('2026-01-01'), -1)).toBe('2025-12-31')
  })

  it('moves an instant by calendar months in UTC, keeping its time of day', () => {
    expect(addMonthsUTC(at('2026-10-17T03:30:00Z'), -6).toISOString()).toBe(
      '2026-04-17T03:30:00.000Z'
    )
    expect(addMonthsUTC(at('2026-03-08T12:00:00Z'), 8).toISOString()).toBe(
      '2026-11-08T12:00:00.000Z'
    )
  })

  it('clamps a month-end instant to the last day of the target month', () => {
    expect(addMonthsUTC(at('2026-08-31T12:00:00Z'), -6).toISOString()).toBe(
      '2026-02-28T12:00:00.000Z'
    )
    expect(addMonthsUTC(at('2024-08-31T12:00:00Z'), -6).toISOString()).toBe(
      '2024-02-29T12:00:00.000Z'
    )
    expect(addMonthsUTC(at('2026-03-31T23:00:00Z'), 1).toISOString()).toBe(
      '2026-04-30T23:00:00.000Z'
    )
  })

  it('counts days inclusively across DST changes and leap days', () => {
    expect(inclusiveDayCount(day('2026-11-01'), day('2026-11-08'))).toBe(8)
    expect(inclusiveDayCount(day('2026-03-01'), day('2026-03-09'))).toBe(9)
    expect(inclusiveDayCount(day('2024-02-27'), day('2024-03-01'))).toBe(4)
    expect(inclusiveDayCount(day('2023-02-27'), day('2023-03-01'))).toBe(3)
    expect(inclusiveDayCount(day('2026-10-17'), day('2026-10-17'))).toBe(1)
  })

  it('reads today in ET and UTC from the same instant across midnight', () => {
    const lateEveningET = at('2026-10-17T03:30:00Z')
    expect(todayET(lateEveningET)).toBe('2026-10-16')
    expect(todayUTC(lateEveningET)).toBe('2026-10-17')
    expect(todayET(at('2026-10-17T04:00:00Z'))).toBe('2026-10-17')
    expect(todayET(at('2026-01-17T04:59:00Z'))).toBe('2026-01-16')
    expect(todayET(at('2026-01-17T05:00:00Z'))).toBe('2026-01-17')
  })

  it('reads the viewer day in the runtime zone', () => {
    const instant = at('2026-10-17T03:30:00Z')
    const expected = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(instant)
    expect(todayInViewerZone(instant)).toBe(expected)
  })

  it('formats a calendar day as that day', () => {
    expect(formatDateOnly(day('2026-11-01'))).toBe('November 1, 2026')
    expect(formatDateOnly(day('2026-11-01'), 'long', 'es')).toBe('1 de noviembre de 2026')
    expect(formatDateOnly(day('2024-02-29'), 'medium')).toBe('Feb 29, 2024')
    expect(formatDateOnly(day('2026-01-01'), 'numeric')).toBe('01/01/2026')
    expect(formatDateOnly(day('2026-01-01'), 'short')).toBe('01/01/26')
  })

  it('formats a range of calendar days', () => {
    expect(formatDateOnlyRange(day('2026-10-09'), day('2026-10-09'))).toBe('Oct 9, 2026')
    expect(formatDateOnlyRange(day('2026-10-09'), day('2026-10-12'))).toBe('Oct 9-12, 2026')
    expect(formatDateOnlyRange(day('2026-10-30'), day('2026-11-02'))).toBe('Oct 30 - Nov 2, 2026')
  })

  it('formats an instant in ET with the zone named', () => {
    expect(formatInstantET(at('2026-10-17T01:30:00Z'))).toBe('Oct 16, 2026, 9:30 PM EDT')
    expect(formatInstantET(at('2026-12-01T17:05:00Z'), { includeYear: false })).toBe(
      'Dec 1, 12:05 PM EST'
    )
  })

  it('starts the business day at 6am ET, including on DST change days', () => {
    expect(businessDayStart(at('2026-10-17T09:59:00Z')).toISOString()).toBe(
      '2026-10-16T10:00:00.000Z'
    )
    expect(businessDayStart(at('2026-10-17T10:00:00Z')).toISOString()).toBe(
      '2026-10-17T10:00:00.000Z'
    )
    expect(businessDayStart(at('2026-03-08T10:30:00Z')).toISOString()).toBe(
      '2026-03-08T10:00:00.000Z'
    )
    expect(businessDayStart(at('2026-11-01T10:30:00Z')).toISOString()).toBe(
      '2026-10-31T10:00:00.000Z'
    )
    expect(businessDayStart(at('2026-11-01T11:00:00Z')).toISOString()).toBe(
      '2026-11-01T11:00:00.000Z'
    )
  })
})

describe('ageOn', () => {
  it('ages up on the birthday, not the day before', () => {
    expect(ageOn(day('2008-10-17'), day('2026-10-16'))).toBe(17)
    expect(ageOn(day('2008-10-17'), day('2026-10-17'))).toBe(18)
    expect(ageOn(day('2008-12-31'), day('2027-01-01'))).toBe(18)
  })

  it('ages a leap-day birthday up on March 1 in a common year', () => {
    expect(ageOn(day('2008-02-29'), day('2026-02-28'))).toBe(17)
    expect(ageOn(day('2008-02-29'), day('2026-03-01'))).toBe(18)
    expect(ageOn(day('2008-02-29'), day('2028-02-29'))).toBe(20)
  })
})

describe('parseInstant', () => {
  it('reads an ISO instant and refuses text that is not one', () => {
    expect(parseInstant('2026-10-17T01:30:00.000Z')?.toISOString()).toBe('2026-10-17T01:30:00.000Z')
    expect(parseInstant('not a date')).toBeNull()
    expect(parseInstant('')).toBeNull()
  })
})

describe('currentYearET', () => {
  it('turns the year at midnight ET, not UTC', () => {
    expect(currentYearET(at('2027-01-01T04:59:00Z'))).toBe(2026)
    expect(currentYearET(at('2027-01-01T05:00:00Z'))).toBe(2027)
  })
})

describe('instantOf', () => {
  it('refuses an invalid Date', () => {
    expect(() => instantOf(new Date('not a date'))).toThrow(RangeError)
  })
})
