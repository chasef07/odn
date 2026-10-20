import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'
import {
  closeAnalyticsPool,
  describeAnalyticsSchema,
  isAnalyticsConfigured,
  runAnalyticsQuery,
} from '../analytics-query'
import { countSubmissions } from '../submissions'
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
      'sms_messages',
      'sms_support_tickets',
      'submissions',
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
    ])
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

describe('isAnalyticsConfigured', () => {
  it('follows ANALYTICS_DATABASE_URL', () => {
    expect(isAnalyticsConfigured()).toBe(true)
    vi.stubEnv('ANALYTICS_DATABASE_URL', '')
    expect(isAnalyticsConfigured()).toBe(false)
    vi.unstubAllEnvs()
  })
})
