import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateAbsenceDates } from '../date-validators'
import { PROCESS_TIME_ZONES, useProcessTimeZone } from './process-time-zone'

function rules(firstDayOff: string, lastDayOff: string) {
  return validateAbsenceDates({ firstDayOff, lastDayOff }).map((error) => error.rule)
}

describe.each(PROCESS_TIME_ZONES)('validateAbsenceDates in a %s runtime', (zone) => {
  useProcessTimeZone(zone)

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-01-15T15:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts a one-day, a seven-day and a future absence', () => {
    expect(rules('2025-01-15', '2025-01-15')).toEqual([])
    expect(rules('2025-01-15', '2025-01-21')).toEqual([])
    expect(rules('2025-01-16', '2025-01-16')).toEqual([])
  })

  it('accepts a first day 7 days back and rejects 8 days back', () => {
    expect(rules('2025-01-08', '2025-01-08')).toEqual([])
    expect(validateAbsenceDates({ firstDayOff: '2025-01-07', lastDayOff: '2025-01-07' })).toEqual([
      {
        field: 'firstDayOff',
        message: 'First day off cannot be more than 7 days in the past',
        rule: 'absence_too_far_past',
      },
    ])
  })

  it('allows November 8 as the earliest first day on November 15, 2026', () => {
    vi.setSystemTime(new Date('2026-11-15T15:00:00Z'))
    expect(rules('2026-11-08', '2026-11-08')).toEqual([])
    expect(rules('2026-11-07', '2026-11-07')).toEqual(['absence_too_far_past'])
  })

  it('counts back from the New York day, not the UTC day', () => {
    vi.setSystemTime(new Date('2026-11-16T00:30:00Z'))
    expect(rules('2026-11-08', '2026-11-08')).toEqual([])
    expect(rules('2026-11-07', '2026-11-07')).toEqual(['absence_too_far_past'])
  })

  it('moves the past-day window at New York midnight in standard and daylight time', () => {
    vi.setSystemTime(new Date('2026-11-16T04:59:00Z'))
    expect(rules('2026-11-08', '2026-11-08')).toEqual([])
    vi.setSystemTime(new Date('2026-11-16T05:00:00Z'))
    expect(rules('2026-11-08', '2026-11-08')).toEqual(['absence_too_far_past'])
    expect(rules('2026-11-09', '2026-11-09')).toEqual([])
    vi.setSystemTime(new Date('2026-07-16T03:59:00Z'))
    expect(rules('2026-07-08', '2026-07-08')).toEqual([])
    vi.setSystemTime(new Date('2026-07-16T04:00:00Z'))
    expect(rules('2026-07-08', '2026-07-08')).toEqual(['absence_too_far_past'])
    expect(rules('2026-07-09', '2026-07-09')).toEqual([])
  })

  it('counts 7 calendar days back across both DST changes', () => {
    vi.setSystemTime(new Date('2026-11-04T17:00:00Z'))
    expect(rules('2026-10-28', '2026-10-28')).toEqual([])
    expect(rules('2026-10-27', '2026-10-27')).toEqual(['absence_too_far_past'])
    vi.setSystemTime(new Date('2026-03-11T16:00:00Z'))
    expect(rules('2026-03-04', '2026-03-04')).toEqual([])
    expect(rules('2026-03-03', '2026-03-03')).toEqual(['absence_too_far_past'])
  })

  it('rejects a reversed range and an 8-day or 15-day absence', () => {
    expect(rules('2025-01-20', '2025-01-19')).toEqual(['absence_reversed'])
    expect(rules('2025-01-15', '2025-01-22')).toEqual(['absence_too_long'])
    expect(rules('2025-01-15', '2025-01-29')).toEqual(['absence_too_long'])
    expect(rules('2025-01-05', '2025-02-10')).toEqual(['absence_too_far_past', 'absence_too_long'])
  })

  it('counts days across leap days, month ends and year ends', () => {
    vi.setSystemTime(new Date('2024-02-25T12:00:00Z'))
    expect(rules('2024-02-28', '2024-03-05')).toEqual([])
    expect(rules('2024-02-28', '2024-03-06')).toEqual(['absence_too_long'])
    vi.setSystemTime(new Date('2024-12-28T12:00:00Z'))
    expect(rules('2024-12-28', '2025-01-03')).toEqual([])
    expect(rules('2024-12-28', '2025-01-04')).toEqual(['absence_too_long'])
  })

  it('counts days across both DST changes', () => {
    vi.setSystemTime(new Date('2026-11-01T18:00:00Z'))
    expect(rules('2026-11-01', '2026-11-07')).toEqual([])
    expect(rules('2026-11-01', '2026-11-08')).toEqual(['absence_too_long'])
    vi.setSystemTime(new Date('2026-03-08T18:00:00Z'))
    expect(rules('2026-03-08', '2026-03-14')).toEqual([])
    expect(rules('2026-03-08', '2026-03-15')).toEqual(['absence_too_long'])
  })

  it('reports a day that is not yyyy-MM-dd or not a real day', () => {
    expect(rules('2025-02-30', '2025-01-15T14:30:00')).toEqual(['date_invalid', 'date_invalid'])
    expect(rules('2025-01-15', '2025-13-01')).toEqual(['date_invalid'])
  })
})
