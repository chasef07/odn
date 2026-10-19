import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, parseDateOnly, utcDateFromDateOnly, type DateOnly } from '../dates'
import { PROCESS_TIME_ZONES, useProcessTimeZone } from './process-time-zone'

const mockFindOverlapping = vi.fn()
vi.mock('@/db/submissions', () => ({
  findApprovedSubmissionsOverlapping: (...args: unknown[]) => mockFindOverlapping(...args),
}))

import { getMonthlyDaysUsed, wouldExceedMonthlyLimit } from '../monthly-limit'

function day(value: string): DateOnly {
  const parsed = parseDateOnly(value)
  if (!parsed) throw new Error(`bad fixture ${value}`)
  return parsed
}

const REFERENCE = day('2025-01-15')
const DOB = day('1990-05-15')

function row(id: string, first: string, last: string) {
  return {
    id,
    firstDayOff: utcDateFromDateOnly(day(first)),
    lastDayOff: utcDateFromDateOnly(day(last)),
    reviewedAt: new Date(`${last}T15:00:00Z`),
  }
}

function usage(reference: DateOnly = REFERENCE) {
  return getMonthlyDaysUsed('John', 'Doe', DOB, reference)
}

describe.each(PROCESS_TIME_ZONES)('monthly limit in a %s runtime', (zone) => {
  useProcessTimeZone(zone)

  beforeEach(() => {
    mockFindOverlapping.mockReset()
    mockFindOverlapping.mockResolvedValue([])
  })

  it('queries approved days in the 30 days before the reference day', async () => {
    await usage()

    expect(mockFindOverlapping).toHaveBeenCalledWith(
      {
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientDateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
      },
      {
        windowStart: new Date('2024-12-16T00:00:00.000Z'),
        windowEnd: new Date('2025-01-14T00:00:00.000Z'),
      }
    )
  })

  it('moves the window with the reference day across a month and a year', async () => {
    await usage(day('2025-03-10'))
    await usage(addDays(REFERENCE, -7))

    expect(mockFindOverlapping.mock.calls.map(([, window]) => window)).toEqual([
      {
        windowStart: new Date('2025-02-08T00:00:00.000Z'),
        windowEnd: new Date('2025-03-09T00:00:00.000Z'),
      },
      {
        windowStart: new Date('2024-12-09T00:00:00.000Z'),
        windowEnd: new Date('2025-01-07T00:00:00.000Z'),
      },
    ])
  })

  it('reports no usage when there are no approved notes', async () => {
    expect(await usage()).toEqual({
      totalDays: 0,
      submissions: [],
      exceedsLimit: false,
      remainingDays: 7,
    })
  })

  it('counts every day of each overlapping note, inside the window or not', async () => {
    mockFindOverlapping.mockResolvedValue([
      row('before-window', '2024-12-11', '2024-12-18'),
      row('inside', '2025-01-05', '2025-01-07'),
      row('after-window', '2025-01-10', '2025-01-15'),
    ])

    const result = await usage()

    expect(result.submissions.map(({ id, days }) => [id, days])).toEqual([
      ['before-window', 8],
      ['inside', 3],
      ['after-window', 6],
    ])
    expect(result.submissions[1]).toMatchObject({
      firstDayOff: '2025-01-05',
      lastDayOff: '2025-01-07',
    })
    expect(result).toMatchObject({ totalDays: 17, exceedsLimit: true, remainingDays: 0 })
  })

  it('counts a note across the November DST change in full', async () => {
    mockFindOverlapping.mockResolvedValue([row('dst', '2026-11-01', '2026-11-08')])

    expect((await usage(day('2026-11-20'))).totalDays).toBe(8)
  })

  it('is at the limit, not over it, at exactly 7 days', async () => {
    mockFindOverlapping.mockResolvedValue([row('week', '2025-01-01', '2025-01-07')])

    expect(await usage()).toMatchObject({ totalDays: 7, exceedsLimit: false, remainingDays: 0 })
  })

  it('adds the requested days to the days already used', async () => {
    mockFindOverlapping.mockResolvedValue([row('prior', '2025-01-05', '2025-01-07')])

    const within = await wouldExceedMonthlyLimit('John', 'Doe', DOB, REFERENCE, day('2025-01-18'))
    const over = await wouldExceedMonthlyLimit('John', 'Doe', DOB, REFERENCE, day('2025-01-19'))
    const single = await wouldExceedMonthlyLimit('John', 'Doe', DOB, REFERENCE, REFERENCE)

    expect(within).toMatchObject({ requestedDays: 4, newTotal: 7, wouldExceed: false })
    expect(over).toMatchObject({ requestedDays: 5, newTotal: 8, wouldExceed: true })
    expect(single).toMatchObject({ requestedDays: 1, newTotal: 4, wouldExceed: false })
  })
})
