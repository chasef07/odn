import { describe, expect, it } from 'vitest'
import { SubmissionStatus } from '@prisma/client'
import {
  buildFriendsFamilyCustomerDetail,
  buildFriendsFamilyAnalytics,
  type FriendsFamilySubmissionInput,
} from '@/lib/friends-family-analytics'

const referenceDate = new Date('2026-06-01T12:00:00.000Z')

function daysAgo(days: number): Date {
  return new Date(referenceDate.getTime() - days * 24 * 60 * 60 * 1000)
}

function submission(
  overrides: Partial<FriendsFamilySubmissionInput> = {}
): FriendsFamilySubmissionInput {
  const createdAt = overrides.createdAt ?? daysAgo(10)

  return {
    id: overrides.id ?? 'sub-1',
    status: overrides.status ?? SubmissionStatus.APPROVED,
    patientFirstName: overrides.patientFirstName ?? 'Jane',
    patientLastName: overrides.patientLastName ?? 'Smith',
    patientDateOfBirth: overrides.patientDateOfBirth ?? new Date('1990-01-01T00:00:00.000Z'),
    guardianFirstName: overrides.guardianFirstName ?? null,
    guardianLastName: overrides.guardianLastName ?? null,
    recipient: overrides.recipient ?? 'myself',
    email: overrides.email ?? 'jane@example.com',
    phone: overrides.phone ?? '(555) 111-2222',
    notePurpose: overrides.notePurpose ?? 'work',
    firstDayOff: overrides.firstDayOff ?? createdAt,
    lastDayOff: overrides.lastDayOff ?? createdAt,
    denialReason: overrides.denialReason ?? null,
    maybeReason: overrides.maybeReason ?? null,
    stripeRefundId: overrides.stripeRefundId ?? null,
    refundedAt: overrides.refundedAt ?? null,
    offerCode: overrides.offerCode ?? null,
    paymentAmount: overrides.paymentAmount ?? 2495,
    createdAt,
    reviewedAt: overrides.reviewedAt ?? createdAt,
    approvalEmailSentAt: overrides.approvalEmailSentAt ?? createdAt,
  }
}

describe('friends-family analytics segmentation', () => {
  it('ranks lapsed repeat full-price customers as the best targets', () => {
    const analytics = buildFriendsFamilyAnalytics(
      [
        submission({ id: 'sub-1', createdAt: daysAgo(45), reviewedAt: daysAgo(45) }),
        submission({ id: 'sub-2', createdAt: daysAgo(75), reviewedAt: daysAgo(75) }),
        submission({ id: 'sub-3', createdAt: daysAgo(120), reviewedAt: daysAgo(120) }),
      ],
      referenceDate
    )

    const customer = analytics.customers[0]

    expect(analytics.summary.bestTargets).toBe(1)
    expect(analytics.summary.repeatCustomers).toBe(1)
    expect(customer.priority).toBe('HIGH_PRIORITY')
    expect(customer.segments).toContain('best_targets')
    expect(customer.reasons.map((reason) => reason.label)).toContain('Sweet spot recency')
    expect(customer.reasons.map((reason) => reason.label)).toContain('Repeat successful customer')
  })

  it('penalizes too-recent customers so they fall out of best targets', () => {
    const analytics = buildFriendsFamilyAnalytics(
      [
        submission({ id: 'sub-1', createdAt: daysAgo(3), reviewedAt: daysAgo(3) }),
        submission({ id: 'sub-2', createdAt: daysAgo(40), reviewedAt: daysAgo(40) }),
      ],
      referenceDate,
      { segment: 'all_customers' }
    )

    const customer = analytics.customers[0]

    expect(analytics.summary.bestTargets).toBe(0)
    expect(customer.segments).not.toContain('best_targets')
    expect(customer.reasons.map((reason) => reason.label)).toContain('Too recent to discount')
  })

  it('keeps customers with prior denials surfaced but lower ranked', () => {
    const analytics = buildFriendsFamilyAnalytics(
      [
        submission({ id: 'approved', createdAt: daysAgo(45), reviewedAt: daysAgo(45) }),
        submission({ id: 'approved-2', createdAt: daysAgo(70), reviewedAt: daysAgo(70) }),
        submission({
          id: 'denied',
          status: SubmissionStatus.DENIED,
          createdAt: daysAgo(80),
          reviewedAt: daysAgo(79),
          denialReason: 'Other',
        }),
      ],
      referenceDate
    )

    const customer = analytics.customers[0]

    expect(customer.refundedNotes).toBe(0)
    expect(customer.deniedNotes).toBe(1)
    expect(customer.segments).toContain('repeat_customers')
    expect(customer.segments).toContain('needs_review')
    expect(customer.reasons.some((reason) => reason.label === '1 prior denial')).toBe(true)
  })

  it('separates refunded customers from best targets', () => {
    const analytics = buildFriendsFamilyAnalytics(
      [
        submission({ id: 'approved', createdAt: daysAgo(12), reviewedAt: daysAgo(12) }),
        submission({
          id: 'refunded',
          status: SubmissionStatus.DENIED,
          createdAt: daysAgo(20),
          reviewedAt: daysAgo(19),
          stripeRefundId: 're_123',
          refundedAt: daysAgo(19),
        }),
      ],
      referenceDate
    )

    const customer = buildFriendsFamilyCustomerDetail(
      [
        submission({ id: 'approved', createdAt: daysAgo(12), reviewedAt: daysAgo(12) }),
        submission({
          id: 'refunded',
          status: SubmissionStatus.DENIED,
          createdAt: daysAgo(20),
          reviewedAt: daysAgo(19),
          stripeRefundId: 're_123',
          refundedAt: daysAgo(19),
        }),
      ],
      'email:jane@example.com',
      referenceDate
    )

    expect(customer?.priority).toBe('REFUND_HISTORY')
    expect(customer?.segments).toContain('refunded')
    expect(customer?.segments).not.toContain('best_targets')
    expect(analytics.summary.refunded).toBe(1)
  })

  it('places open maybe cases on hold', () => {
    const customer = buildFriendsFamilyCustomerDetail(
      [
        submission({ id: 'approved', createdAt: daysAgo(40), reviewedAt: daysAgo(40) }),
        submission({
          id: 'maybe',
          status: SubmissionStatus.MAYBE,
          createdAt: daysAgo(2),
          reviewedAt: null,
          maybeReason: 'OTHER_REVIEW',
        }),
      ],
      'email:jane@example.com',
      referenceDate
    )

    expect(customer?.priority).toBe('HOLD')
    expect(customer?.openNotes).toBe(1)
    expect(customer?.segments).toContain('needs_review')
    expect(customer?.segments).not.toContain('best_targets')
  })

  it('groups by customer email and detects multiple-patient family signal', () => {
    const analytics = buildFriendsFamilyAnalytics(
      [
        submission({
          id: 'parent-note',
          recipient: 'someone_else',
          guardianFirstName: 'Taylor',
          guardianLastName: 'Smith',
          patientFirstName: 'Avery',
          patientLastName: 'Smith',
          patientDateOfBirth: new Date('2012-01-01T00:00:00.000Z'),
          createdAt: daysAgo(8),
          reviewedAt: daysAgo(8),
        }),
        submission({
          id: 'second-child-note',
          recipient: 'someone_else',
          guardianFirstName: 'Taylor',
          guardianLastName: 'Smith',
          patientFirstName: 'Riley',
          patientLastName: 'Smith',
          patientDateOfBirth: new Date('2014-01-01T00:00:00.000Z'),
          createdAt: daysAgo(70),
          reviewedAt: daysAgo(70),
        }),
      ],
      referenceDate,
      { segment: 'all_customers' }
    )

    const customer = analytics.customers[0]

    expect(analytics.summary.totalCustomers).toBe(1)
    expect(customer.displayName).toBe('Taylor Smith')
    expect(customer.uniquePatients).toBe(2)
    expect(customer.familySignal).toBe(true)
    expect(customer.segments).toContain('family_signal')
  })

  it('returns limited segment rows without timelines or score factors', () => {
    // 60 distinct repeat customers, each with two approved notes 40 and 80 days ago.
    const submissions = Array.from({ length: 60 }, (_, index) => [
      submission({
        id: `sub-${index}-recent`,
        email: `customer-${index}@example.com`,
        createdAt: daysAgo(40),
        reviewedAt: daysAgo(40),
      }),
      submission({
        id: `sub-${index}-older`,
        email: `customer-${index}@example.com`,
        createdAt: daysAgo(80),
        reviewedAt: daysAgo(80),
      }),
    ]).flat()

    const analytics = buildFriendsFamilyAnalytics(submissions, referenceDate, {
      segment: 'best_targets',
      limit: 10,
    })

    expect(analytics.segmentTotal).toBe(60)
    expect(analytics.customers).toHaveLength(10)
    expect('timeline' in analytics.customers[0]).toBe(false)
    expect('scoreFactors' in analytics.customers[0]).toBe(false)
  })

  it('segments customers who never requested a refund and ranks them by note volume', () => {
    const analytics = buildFriendsFamilyAnalytics(
      [
        // Single approved note.
        submission({ id: 'one', email: 'one@example.com', createdAt: daysAgo(5) }),
        // Three approved notes — most volume, should rank first.
        submission({ id: 'three-a', email: 'three@example.com', createdAt: daysAgo(20) }),
        submission({ id: 'three-b', email: 'three@example.com', createdAt: daysAgo(50) }),
        submission({ id: 'three-c', email: 'three@example.com', createdAt: daysAgo(90) }),
        // Refunded customer — excluded entirely.
        submission({
          id: 'refunded',
          email: 'refunded@example.com',
          status: SubmissionStatus.DENIED,
          stripeRefundId: 're_123',
          refundedAt: daysAgo(19),
          createdAt: daysAgo(20),
        }),
      ],
      referenceDate,
      { segment: 'no_refunds' }
    )

    expect(analytics.summary.noRefunds).toBe(2)
    expect(analytics.customers.map((customer) => customer.email)).toEqual([
      'three@example.com',
      'one@example.com',
    ])
    expect(analytics.customers[0].approvedNotes).toBe(3)
    expect(analytics.customers[0].segments).toContain('no_refunds')
  })

  it('sorts the all-customers view by most recent approval, not targeting score', () => {
    const analytics = buildFriendsFamilyAnalytics(
      [
        // Lapsed repeat customer: high targeting score, but older approval.
        submission({ id: 'lapsed-1', email: 'lapsed@example.com', createdAt: daysAgo(45) }),
        submission({ id: 'lapsed-2', email: 'lapsed@example.com', createdAt: daysAgo(80) }),
        // Fresh single approval: lower score, but most recent.
        submission({ id: 'fresh', email: 'fresh@example.com', createdAt: daysAgo(2) }),
      ],
      referenceDate,
      { segment: 'all_customers' }
    )

    expect(analytics.customers[0].email).toBe('fresh@example.com')
  })

  it('reports gross, refunded, and net revenue separately', () => {
    const analytics = buildFriendsFamilyAnalytics(
      [
        submission({
          id: 'paid',
          email: 'paid@example.com',
          paymentAmount: 2495,
          createdAt: daysAgo(5),
          reviewedAt: daysAgo(5),
        }),
        submission({
          id: 'refunded',
          email: 'refunded@example.com',
          status: SubmissionStatus.DENIED,
          paymentAmount: 2495,
          createdAt: daysAgo(12),
          reviewedAt: daysAgo(11),
          stripeRefundId: 're_123',
          refundedAt: daysAgo(11),
        }),
      ],
      referenceDate,
      { segment: 'all_customers' }
    )

    expect(analytics.summary.grossRevenueCents).toBe(4990)
    expect(analytics.summary.refundedRevenueCents).toBe(2495)
    expect(analytics.summary.netRevenueCents).toBe(2495)
  })
})
