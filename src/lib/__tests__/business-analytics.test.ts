import { describe, expect, it } from 'vitest'
import { SubmissionStatus } from '@prisma/client'
import {
  buildBusinessAnalytics,
  type BusinessAnalyticsSubmissionInput,
} from '@/lib/business-analytics'

const referenceDate = new Date('2026-06-01T12:00:00.000Z')

function daysAgo(days: number): Date {
  return new Date(referenceDate.getTime() - days * 24 * 60 * 60 * 1000)
}

function submission(
  overrides: Partial<BusinessAnalyticsSubmissionInput> = {}
): BusinessAnalyticsSubmissionInput {
  const createdAt = overrides.createdAt ?? daysAgo(5)

  return {
    id: overrides.id ?? 'sub-1',
    status: overrides.status ?? SubmissionStatus.APPROVED,
    state: overrides.state ?? 'New York',
    patientFirstName: overrides.patientFirstName ?? 'Jane',
    patientLastName: overrides.patientLastName ?? 'Smith',
    patientDateOfBirth: overrides.patientDateOfBirth ?? new Date('1990-01-01T00:00:00.000Z'),
    email: overrides.email ?? 'jane@example.com',
    phone: overrides.phone ?? '(555) 111-2222',
    offerCode: overrides.offerCode ?? null,
    paymentAmount: overrides.paymentAmount ?? 2495,
    stripeRefundId: overrides.stripeRefundId ?? null,
    refundedAt: overrides.refundedAt ?? null,
    createdAt,
  }
}

describe('business analytics', () => {
  it('defaults to the last 30 days and reports net revenue after refunds', () => {
    const analytics = buildBusinessAnalytics(
      [
        submission({ id: 'paid', paymentAmount: 2495, createdAt: daysAgo(3) }),
        submission({
          id: 'refunded',
          status: SubmissionStatus.DENIED,
          paymentAmount: 2495,
          stripeRefundId: 're_123',
          refundedAt: daysAgo(2),
          createdAt: daysAgo(2),
        }),
        submission({ id: 'previous', paymentAmount: 2495, createdAt: daysAgo(35) }),
      ],
      referenceDate
    )

    expect(analytics.summary.range).toBe('30d')
    expect(analytics.summary.totalNotes).toBe(2)
    expect(analytics.summary.grossRevenueCents).toBe(4990)
    expect(analytics.summary.refundedRevenueCents).toBe(2495)
    expect(analytics.summary.netRevenueCents).toBe(2495)
    expect(analytics.summary.refundRate).toBe(0.5)
    expect(analytics.summary.netRevenueDeltaPct).toBe(0)
  })

  it('keeps geography and age bands all-time even when the default range is 30 days', () => {
    const analytics = buildBusinessAnalytics(
      [
        submission({
          id: 'current-ny',
          state: 'New York',
          patientDateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
          createdAt: daysAgo(4),
        }),
        submission({
          id: 'old-ca',
          state: 'California',
          patientDateOfBirth: new Date('2010-01-01T00:00:00.000Z'),
          createdAt: daysAgo(200),
        }),
      ],
      referenceDate
    )

    expect(analytics.summary.totalNotes).toBe(1)
    expect(analytics.stateRows.map((row) => row.state)).toContain('California')
    expect(analytics.ageBands.map((band) => band.key)).toContain('under_18')
    expect(analytics.ageBands.map((band) => band.key)).toContain('35_44')
  })

  it('counts returning customers and 3-plus-note customers over six months', () => {
    const analytics = buildBusinessAnalytics(
      [
        submission({ id: 'current-1', email: 'repeat@example.com', createdAt: daysAgo(5) }),
        submission({ id: 'current-2', email: 'repeat@example.com', createdAt: daysAgo(20) }),
        submission({ id: 'prior', email: 'repeat@example.com', createdAt: daysAgo(75) }),
        submission({ id: 'new', email: 'new@example.com', createdAt: daysAgo(7) }),
      ],
      referenceDate
    )

    expect(analytics.summary.totalCustomers).toBe(2)
    expect(analytics.summary.repeatCustomers).toBe(1)
    expect(analytics.summary.newCustomers).toBe(1)
    expect(analytics.summary.threePlusNotesSixMonthsCustomers).toBe(1)
  })

  it('uses all-time monthly trend without comparison deltas for all-time range', () => {
    const analytics = buildBusinessAnalytics(
      [
        submission({ id: 'march', createdAt: new Date('2026-03-15T12:00:00.000Z') }),
        submission({ id: 'june', createdAt: new Date('2026-06-01T12:00:00.000Z') }),
      ],
      referenceDate,
      { range: 'all' }
    )

    expect(analytics.summary.rangeLabel).toBe('All time')
    expect(analytics.summary.netRevenueDeltaPct).toBeNull()
    expect(analytics.summary.notesDeltaPct).toBeNull()
    expect(analytics.trend[0].key).toBe('2026-03')
    expect(analytics.trend.at(-1)?.key).toBe('2026-06')
  })

  it('labels unchanged refund-rate comparisons as steady', () => {
    const analytics = buildBusinessAnalytics(
      [
        submission({ id: 'current', email: 'current@example.com', createdAt: daysAgo(3) }),
        submission({ id: 'previous', email: 'previous@example.com', createdAt: daysAgo(35) }),
      ],
      referenceDate
    )

    expect(analytics.summary.refundRateDeltaPoints).toBe(0)
    expect(analytics.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Refund rate steady',
          detail: expect.stringContaining('unchanged'),
          tone: 'neutral',
        }),
      ])
    )
  })

  it('omits rate comparison deltas when the previous period has no denominator', () => {
    const analytics = buildBusinessAnalytics(
      [
        submission({
          id: 'current-refund',
          status: SubmissionStatus.DENIED,
          stripeRefundId: 're_123',
          refundedAt: daysAgo(3),
          createdAt: daysAgo(3),
        }),
      ],
      referenceDate
    )

    expect(analytics.summary.refundRate).toBe(1)
    expect(analytics.summary.refundRateDeltaPoints).toBeNull()
    expect(analytics.summary.repeatCustomerRateDeltaPoints).toBeNull()
    expect(analytics.insights.map((insight) => insight.title)).not.toContain('Refund rate watch')
    expect(analytics.insights.map((insight) => insight.title)).not.toContain('Refund rate steady')
  })
})
