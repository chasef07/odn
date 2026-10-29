import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'
import { parseDateOnly, type DateOnly } from '@/lib/dates'
import {
  closeAnalyticsPool,
  customerTotals,
  describeAnalyticsSchema,
  isAnalyticsConfigured,
  notesSplit,
  runAnalyticsQuery,
} from '../analytics-query'
import { db } from '../pool'
import { countSubmissions } from '../submissions'
import { insert } from '../table'
import { funnelSteps } from '../tables'
import { SubmissionStatus } from '../types'
import { seedSubmission } from './seed'

const PAID_AT = new Date('2026-03-06T03:30:00.000Z')

beforeAll(() => {
  process.env.ANALYTICS_DATABASE_URL = inject('testDatabaseUrl')
})

afterAll(async () => {
  await closeAnalyticsPool()
})

describe('runAnalyticsQuery', () => {
  it('runs as analytics_reader in a read-only transaction on the analytics schema with a 10s timeout', async () => {
    const result = await runAnalyticsQuery(
      "select current_user as role, current_setting('transaction_read_only') as read_only, current_setting('search_path') as search_path, current_setting('statement_timeout') as timeout"
    )

    expect(result.rows).toEqual([
      { role: 'analytics_reader', read_only: 'on', search_path: 'analytics', timeout: '10s' },
    ])
  })

  it('rejects reading a public table, which the reader role has no grant on', async () => {
    await expect(runAnalyticsQuery('select * from public.submissions')).rejects.toThrow(
      'permission denied for table submissions'
    )
  })

  it('rejects writes and leaves the rows in place', async () => {
    await seedSubmission({ status: SubmissionStatus.APPROVED, refund: 'none' })

    await expect(runAnalyticsQuery('delete from public.submissions')).rejects.toThrow()
    await expect(
      runAnalyticsQuery(
        'with gone as (delete from public.submissions returning id) select * from gone'
      )
    ).rejects.toThrow('data-modifying statement')
    await expect(runAnalyticsQuery("insert into submissions (id) values ('x')")).rejects.toThrow()

    expect(await countSubmissions()).toBe(1)
  })

  it('reads through the views, with dates as ISO strings, numerics as numbers and derived columns', async () => {
    await seedSubmission(
      { status: SubmissionStatus.APPROVED, refund: 'refunded' },
      { createdAt: PAID_AT, paymentAmount: 2495, email: ' Pat@Example.com ' }
    )
    await seedSubmission(
      { status: SubmissionStatus.DENIED, refund: 'none' },
      { createdAt: PAID_AT, email: 'pat@example.com' }
    )
    await seedSubmission(
      { status: SubmissionStatus.DENIED, refund: 'none' },
      { createdAt: PAID_AT, email: 'sam@example.com' }
    )

    const result = await runAnalyticsQuery(
      "select created_at, created_day_et, days_off, patient_age_years, refunded, payment_amount_cents / 100.0 as dollars from submissions where status = 'APPROVED'"
    )
    const customers = await runAnalyticsQuery(
      'select count(distinct customer_id) as customers from submissions'
    )

    expect(result.columns).toEqual([
      'created_at',
      'created_day_et',
      'days_off',
      'patient_age_years',
      'refunded',
      'dollars',
    ])
    expect(result.rows).toEqual([
      {
        created_at: '2026-03-06T03:30:00.000Z',
        created_day_et: '2026-03-05',
        days_off: 3,
        patient_age_years: 35,
        refunded: true,
        dollars: 24.95,
      },
    ])
    expect(customers.rows).toEqual([{ customers: 2 }])
  })

  it('reads the first touch beside the last touch, and null without stored attribution', async () => {
    const touch = (channel: string, source: string) => ({
      channel,
      source,
      medium: null,
      campaign: null,
      content: null,
      term: null,
      clickIds: { gclid: 'secret-click-id' },
      referrer: 'https://www.reddit.com/r/x',
      landingPath: '/',
      at: '2026-03-01T12:00:00.000Z',
    })
    await seedSubmission(
      { status: SubmissionStatus.APPROVED, refund: 'none' },
      {
        createdAt: PAID_AT,
        attributionChannel: 'google_ads',
        attribution: { first: touch('reddit', 'reddit'), last: touch('google_ads', 'google') },
      }
    )
    await seedSubmission(
      { status: SubmissionStatus.APPROVED, refund: 'none' },
      { createdAt: new Date('2026-03-07T12:00:00.000Z'), attribution: null }
    )

    const result = await runAnalyticsQuery(
      'select attribution_channel, first_attribution_channel, first_source from submissions order by created_at'
    )

    expect(result.rows).toEqual([
      {
        attribution_channel: 'google_ads',
        first_attribution_channel: 'reddit',
        first_source: 'reddit',
      },
      { attribution_channel: null, first_attribution_channel: null, first_source: null },
    ])
  })

  it('reads funnel steps with their business day', async () => {
    const step = {
      visitorId: '6f1c2a8e-4b7d-4c3a-9e2f-1a2b3c4d5e6f',
      stepOrder: 1,
      locale: 'en',
      attributionChannel: 'google_ads',
      createdAt: PAID_AT,
    }
    await db.affected(insert(funnelSteps, { ...step, step: '/get-started' }))
    await db.affected(insert(funnelSteps, { ...step, step: '/get-started' }))

    const result = await runAnalyticsQuery(
      'select step, created_day_et, count(distinct visitor_id) as visitors, count(*) as views from funnel_steps group by 1, 2'
    )

    expect(result.rows).toEqual([
      { step: '/get-started', created_day_et: '2026-03-05', visitors: 1, views: 2 },
    ])
  })

  it('returns at most 500 rows and stops Postgres reading at the 501st', async () => {
    const result = await runAnalyticsQuery(
      'select case when i <= 501 then i else i / (i - i) end as i from generate_series(1, 1000) as i'
    )

    expect(result.rows).toHaveLength(500)
    expect(result.rows.at(-1)).toEqual({ i: 500 })
    expect(result.truncated).toBe(true)
  })

  it('does not mark exactly 500 rows truncated', async () => {
    const result = await runAnalyticsQuery('select i from generate_series(1, 500) as i')

    expect(result.rows).toHaveLength(500)
    expect(result.truncated).toBe(false)
  })

  it('strips trailing semicolons and survives a trailing line comment', async () => {
    expect((await runAnalyticsQuery('select 1 as one;; \n')).rows).toEqual([{ one: 1 }])
    expect((await runAnalyticsQuery('select 1 as one -- just one')).rows).toEqual([{ one: 1 }])
  })

  it('returns the columns of an empty result', async () => {
    const result = await runAnalyticsQuery('select id, status from submissions where false')

    expect(result).toEqual({ columns: ['id', 'status'], rows: [], truncated: false })
  })

  it('throws the Postgres message for a bad query', async () => {
    await expect(runAnalyticsQuery('select nope from submissions')).rejects.toThrow(
      'column "nope" does not exist'
    )
  })

  it('rejects a second statement', async () => {
    await expect(runAnalyticsQuery('select 1) as a; select (1')).rejects.toThrow(
      'cannot insert multiple commands into a prepared statement'
    )
  })
})

describe('describeAnalyticsSchema', () => {
  it('lists the analytics views and their columns in order, every one described', async () => {
    const views = await describeAnalyticsSchema()

    expect(views.map((view) => view.name)).toEqual([
      'funnel_steps',
      'sms_messages',
      'sms_support_tickets',
      'submissions',
    ])
    const funnel = views.find((view) => view.name === 'funnel_steps')
    expect(funnel?.description).toContain('distinct visitor_id')
    expect(funnel?.columns.map((column) => column.name)).toEqual([
      'visitor_id',
      'step',
      'step_order',
      'locale',
      'attribution_channel',
      'created_at',
      'created_day_et',
    ])
    const submissions = views.find((view) => view.name === 'submissions')
    expect(submissions?.description).toContain('paid doctor')
    expect(submissions?.columns.map((column) => column.name)).toEqual([
      'id',
      'created_at',
      'created_day_et',
      'status',
      'payment_amount_cents',
      'offer_code',
      'state',
      'note_purpose',
      'absence_reason',
      'days_off',
      'patient_age_years',
      'denial_reason',
      'refunded',
      'refunded_at',
      'reviewed_at',
      'attribution_channel',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'customer_id',
      'customer_note_number',
      'is_returning',
      'first_attribution_channel',
      'first_source',
    ])
    expect(
      submissions?.columns.find((column) => column.name === 'attribution_channel')?.description
    ).toContain('last touch')
    expect(
      submissions?.columns.find((column) => column.name === 'first_attribution_channel')
        ?.description
    ).toContain('first touch')
    expect(submissions?.columns.find((column) => column.name === 'payment_amount_cents')).toEqual({
      name: 'payment_amount_cents',
      type: 'integer',
      description: expect.stringContaining('cents'),
    })
    expect(submissions?.columns.find((column) => column.name === 'created_day_et')?.type).toBe(
      'date'
    )
    for (const view of views) {
      expect(view.description, view.name).not.toBeNull()
      for (const column of view.columns) {
        expect(column.description, `${view.name}.${column.name}`).not.toBeNull()
      }
    }
  })

  it('exposes no direct identifiers', async () => {
    const names = (await describeAnalyticsSchema()).flatMap((view) =>
      view.columns.map((column) => column.name)
    )

    for (const identifier of [
      'email',
      'phone',
      'phone_e164',
      'patient_first_name',
      'patient_last_name',
      'patient_date_of_birth',
      'body',
      'to',
      'from',
      'symptoms',
      'admin_summary',
    ]) {
      expect(names).not.toContain(identifier)
    }
  })
})

const TODAY = parseDateOnly('2026-03-10') as DateOnly

async function note(email: string, paidAt: string) {
  await seedSubmission(
    { status: SubmissionStatus.APPROVED, refund: 'none' },
    { email, createdAt: new Date(paidAt) }
  )
}

describe('customerTotals', () => {
  it('counts all notes, customers by email and customers with a second note', async () => {
    await note('pat@example.com', '2026-01-05T15:00:00.000Z')
    await note(' PAT@example.com ', '2026-02-05T15:00:00.000Z')
    await note('sam@example.com', '2026-01-06T15:00:00.000Z')
    await note('kim@example.com', '2026-01-08T15:00:00.000Z')
    await note('lee@example.com', '2026-01-07T15:00:00.000Z')
    await note('lee@example.com', '2026-02-07T15:00:00.000Z')
    await note('lee@example.com', '2026-03-07T15:00:00.000Z')

    expect(await customerTotals()).toEqual({
      totalNotes: 7,
      uniqueCustomers: 4,
      repeatCustomers: 2,
    })
  })

  it('returns zeros with no notes', async () => {
    expect(await customerTotals()).toEqual({
      totalNotes: 0,
      uniqueCustomers: 0,
      repeatCustomers: 0,
    })
  })
})

describe('notesSplit', () => {
  it('splits each of the last 30 business days into first notes and returning notes', async () => {
    await note('sam@example.com', '2026-02-08T15:00:00.000Z')
    await note('pat@example.com', '2026-02-09T15:00:00.000Z')
    await note('sam@example.com', '2026-03-10T15:00:00.000Z')
    await note('pat@example.com', '2026-03-10T16:00:00.000Z')
    await note('lee@example.com', '2026-03-11T03:00:00.000Z')
    await note('kim@example.com', '2026-03-11T15:00:00.000Z')

    const days = await notesSplit('day', TODAY)

    expect(days).toHaveLength(30)
    expect(days[0]).toEqual({ start: '2026-02-09', label: 'Feb 9', newNotes: 1, returningNotes: 0 })
    expect(days[1]).toEqual({
      start: '2026-02-10',
      label: 'Feb 10',
      newNotes: 0,
      returningNotes: 0,
    })
    expect(days.at(-1)).toEqual({
      start: '2026-03-10',
      label: 'Mar 10',
      newNotes: 1,
      returningNotes: 2,
    })
    expect(days.slice(1, -1).every((day) => day.newNotes + day.returningNotes === 0)).toBe(true)
  })

  it('splits each of the last 12 months into first notes and returning notes', async () => {
    await note('sam@example.com', '2025-03-31T15:00:00.000Z')
    await note('sam@example.com', '2025-04-01T15:00:00.000Z')
    await note('pat@example.com', '2025-04-02T15:00:00.000Z')
    await note('pat@example.com', '2026-03-02T15:00:00.000Z')
    await note('lee@example.com', '2026-03-03T15:00:00.000Z')

    const months = await notesSplit('month', TODAY)

    expect(months.map((month) => month.label)).toEqual([
      'Apr 2025',
      'May 2025',
      'Jun 2025',
      'Jul 2025',
      'Aug 2025',
      'Sep 2025',
      'Oct 2025',
      'Nov 2025',
      'Dec 2025',
      'Jan 2026',
      'Feb 2026',
      'Mar 2026',
    ])
    expect(months[0]).toEqual({
      start: '2025-04-01',
      label: 'Apr 2025',
      newNotes: 1,
      returningNotes: 1,
    })
    expect(months.at(-1)).toEqual({
      start: '2026-03-01',
      label: 'Mar 2026',
      newNotes: 1,
      returningNotes: 1,
    })
  })
})

describe('isAnalyticsConfigured', () => {
  it('follows ANALYTICS_DATABASE_URL', () => {
    expect(isAnalyticsConfigured()).toBe(true)
    vi.stubEnv('ANALYTICS_DATABASE_URL', '')
    expect(isAnalyticsConfigured()).toBe(false)
    vi.unstubAllEnvs()
  })
})
