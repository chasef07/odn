import { SubmissionStatus } from '@/db/types'
import { getCustomerKey, isOpenStatus, MS_PER_DAY, toIsoDate } from '@/lib/analytics-shared'
import { addMonthsUTC, dateOnlyFromUtcDate } from '@/lib/dates'
import { DOCTOR_10_OFFER_CODE, normalizeOfferCode } from '@/lib/offer-codes'

export type FriendsFamilySegmentKey =
  | 'best_targets'
  | 'recent_approvals'
  | 'repeat_customers'
  | 'no_refunds'
  | 'family_signal'
  | 'needs_review'
  | 'refunded'
  | 'offer_used'

export type FriendsFamilySegmentFilter = FriendsFamilySegmentKey | 'all_customers'

export type FriendsFamilyPriority =
  | 'HIGH_PRIORITY'
  | 'GOOD_TARGET'
  | 'LOWER_PRIORITY'
  | 'HOLD'
  | 'REFUND_HISTORY'
  | 'NEEDS_REVIEW'

export type FriendsFamilyTone = 'positive' | 'warning' | 'negative' | 'neutral'

export type FriendsFamilySubmissionInput = {
  id: string
  status: SubmissionStatus
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: Date
  guardianFirstName: string | null
  guardianLastName: string | null
  recipient: string
  email: string
  phone: string
  maybeReason: string | null
  stripeRefundId: string | null
  refundedAt: Date | null
  offerCode: string | null
  paymentAmount: number | null
  createdAt: Date
  reviewedAt: Date | null
  approvalEmailSentAt: Date | null
}

export type FriendsFamilyReason = {
  label: string
  tone: FriendsFamilyTone
}

export type FriendsFamilyCustomerRow = {
  customerKey: string
  displayName: string
  email: string
  phone: string
  score: number
  priority: FriendsFamilyPriority
  segments: FriendsFamilySegmentKey[]
  reasons: FriendsFamilyReason[]
  lastSubmittedAt: string
  lastApprovedAt: string | null
  firstSubmittedAt: string
  totalNotes: number
  approvedNotes: number
  approvedLast30Days: number
  approvedLastSixMonths: number
  deniedNotes: number
  maybeNotes: number
  openNotes: number
  refundedNotes: number
  offerUsedCount: number
  standardPriceNotes: number
  grossRevenueCents: number
  refundedRevenueCents: number
  netRevenueCents: number
  uniquePatients: number
  familySignal: boolean
}

export type FriendsFamilyAnalyticsSummary = {
  totalCustomers: number
  bestTargets: number
  recentApprovals: number
  repeatCustomers: number
  noRefunds: number
  familySignal: number
  needsReview: number
  refunded: number
  offerUsed: number
  offerNotesCount: number
  offerNetRevenueCents: number
  grossRevenueCents: number
  refundedRevenueCents: number
  netRevenueCents: number
}

export type FriendsFamilyAnalytics = {
  generatedAt: string
  summary: FriendsFamilyAnalyticsSummary
  activeSegment: FriendsFamilySegmentFilter
  segmentTotal: number
  limit: number
  customers: FriendsFamilyCustomerRow[]
}

export type FriendsFamilyAnalyticsOptions = {
  segment?: FriendsFamilySegmentFilter
  limit?: number
}

function submissionCustomerName(submission: FriendsFamilySubmissionInput): string {
  if (submission.guardianFirstName || submission.guardianLastName) {
    return [submission.guardianFirstName, submission.guardianLastName].filter(Boolean).join(' ')
  }

  return [submission.patientFirstName, submission.patientLastName].filter(Boolean).join(' ')
}

function approvedAt(submission: FriendsFamilySubmissionInput): Date | null {
  if (
    submission.status !== SubmissionStatus.APPROVED ||
    submission.refundedAt ||
    submission.stripeRefundId
  ) {
    return null
  }

  return submission.reviewedAt ?? submission.approvalEmailSentAt ?? submission.createdAt
}

function priorityFromScore(
  score: number,
  hasRefund: boolean,
  hasOpenIssue: boolean
): FriendsFamilyPriority {
  if (hasRefund) return 'REFUND_HISTORY'
  if (hasOpenIssue) return 'HOLD'
  if (score >= 75) return 'HIGH_PRIORITY'
  if (score >= 55) return 'GOOD_TARGET'
  if (score >= 35) return 'LOWER_PRIORITY'
  return 'NEEDS_REVIEW'
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function buildCustomerRow(
  customerKey: string,
  submissions: FriendsFamilySubmissionInput[],
  referenceDate: Date
): FriendsFamilyCustomerRow {
  const sorted = [...submissions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const latest = sorted[0]
  const thirtyDaysAgo = new Date(referenceDate.getTime() - 30 * MS_PER_DAY)
  const sixMonthsAgo = addMonthsUTC(referenceDate, -6)

  const approvedDates = sorted.map(approvedAt).filter((date): date is Date => Boolean(date))
  const lastApprovedAt =
    approvedDates.length > 0
      ? new Date(Math.max(...approvedDates.map((date) => date.getTime())))
      : null

  const approvedNotes = approvedDates.length
  const approvedLast30Days = approvedDates.filter((date) => date >= thirtyDaysAgo).length
  const approvedLastSixMonths = approvedDates.filter((date) => date >= sixMonthsAgo).length
  const deniedNotes = sorted.filter(
    (submission) => submission.status === SubmissionStatus.DENIED
  ).length
  const maybeNotes = sorted.filter(
    (submission) => submission.status === SubmissionStatus.MAYBE || Boolean(submission.maybeReason)
  ).length
  const openNotes = sorted.filter((submission) => isOpenStatus(submission.status)).length
  const refundedNotes = sorted.filter(
    (submission) => Boolean(submission.refundedAt) || Boolean(submission.stripeRefundId)
  ).length
  const offerUsedCount = sorted.filter(
    (submission) => normalizeOfferCode(submission.offerCode) === DOCTOR_10_OFFER_CODE
  ).length
  const standardPriceNotes = sorted.filter(
    (submission) => !normalizeOfferCode(submission.offerCode)
  ).length
  const grossRevenueCents = sorted.reduce(
    (total, submission) => total + (submission.paymentAmount ?? 0),
    0
  )
  const refundedRevenueCents = sorted
    .filter((submission) => Boolean(submission.refundedAt) || Boolean(submission.stripeRefundId))
    .reduce((total, submission) => total + (submission.paymentAmount ?? 0), 0)
  const netRevenueCents = grossRevenueCents - refundedRevenueCents

  const uniquePatients = new Set(
    sorted.map(
      (submission) =>
        `${submission.patientFirstName.toLowerCase()}:${submission.patientLastName.toLowerCase()}:${dateOnlyFromUtcDate(submission.patientDateOfBirth)}`
    )
  ).size

  const familySignal =
    uniquePatients > 1 ||
    sorted.some(
      (submission) =>
        submission.recipient === 'someone_else' ||
        Boolean(submission.guardianFirstName) ||
        Boolean(submission.guardianLastName)
    )

  const daysSinceLastApproved =
    lastApprovedAt !== null
      ? Math.floor((referenceDate.getTime() - lastApprovedAt.getTime()) / MS_PER_DAY)
      : null

  const factors: (FriendsFamilyReason & { value: number })[] = []

  if (approvedNotes >= 2) {
    factors.push({ label: 'Repeat successful customer', value: 30, tone: 'positive' })
  }
  if (approvedNotes >= 3) {
    factors.push({ label: '3+ approved notes', value: 10, tone: 'positive' })
  }

  if (daysSinceLastApproved !== null) {
    if (daysSinceLastApproved < 14) {
      factors.push({ label: 'Too recent to discount', value: -20, tone: 'warning' })
    } else if (daysSinceLastApproved < 30) {
      factors.push({ label: 'Recently active', value: 5, tone: 'positive' })
    } else if (daysSinceLastApproved <= 90) {
      factors.push({ label: 'Sweet spot recency', value: 25, tone: 'positive' })
    } else if (daysSinceLastApproved <= 180) {
      factors.push({ label: 'Cooling off', value: -5, tone: 'warning' })
    } else {
      factors.push({ label: 'Cold lead', value: -20, tone: 'warning' })
    }
  }

  if (approvedNotes === 0) {
    factors.push({ label: 'No approved history', value: -15, tone: 'warning' })
  }

  if (familySignal) {
    factors.push({ label: 'Family or caregiver pattern', value: 8, tone: 'positive' })
  }

  if (refundedNotes === 0) {
    factors.push({ label: 'No refund history', value: 12, tone: 'positive' })
  } else {
    factors.push({ label: 'Refund history', value: -45, tone: 'negative' })
  }

  if (deniedNotes === 0) {
    factors.push({ label: 'No denial history', value: 5, tone: 'positive' })
  } else {
    factors.push({
      label: `${deniedNotes} prior ${deniedNotes === 1 ? 'denial' : 'denials'}`,
      value: Math.max(-20, -8 * deniedNotes),
      tone: 'warning',
    })
  }

  if (maybeNotes > 0) {
    factors.push({ label: 'Maybe review history', value: -5, tone: 'warning' })
  }

  if (openNotes > 0) {
    factors.push({ label: 'Open case needs resolution', value: -30, tone: 'warning' })
  }

  if (offerUsedCount > 0) {
    factors.push({ label: 'Already used doctor10', value: -25, tone: 'warning' })
  } else if (standardPriceNotes > 0) {
    factors.push({ label: 'Paid standard price before', value: 8, tone: 'positive' })
  }

  const reasons = factors.map(({ label, tone }): FriendsFamilyReason => ({ label, tone }))
  const finalScore = clampScore(factors.reduce((total, factor) => total + factor.value, 0))
  const priority = priorityFromScore(finalScore, refundedNotes > 0, openNotes > 0)
  const segments: FriendsFamilySegmentKey[] = []

  if (
    approvedNotes >= 2 &&
    daysSinceLastApproved !== null &&
    daysSinceLastApproved >= 30 &&
    daysSinceLastApproved <= 90 &&
    offerUsedCount === 0 &&
    refundedNotes === 0 &&
    openNotes === 0
  ) {
    segments.push('best_targets')
  }
  if (approvedLast30Days > 0 && refundedNotes === 0) segments.push('recent_approvals')
  if (approvedNotes >= 2) segments.push('repeat_customers')
  if (refundedNotes === 0) segments.push('no_refunds')
  if (familySignal) segments.push('family_signal')
  if (openNotes > 0 || deniedNotes > 0 || maybeNotes > 0) segments.push('needs_review')
  if (refundedNotes > 0) segments.push('refunded')
  if (offerUsedCount > 0) segments.push('offer_used')

  return {
    customerKey,
    displayName: submissionCustomerName(latest),
    email: latest.email,
    phone: latest.phone,
    score: finalScore,
    priority,
    segments,
    reasons,
    lastSubmittedAt: toIsoDate(latest.createdAt),
    lastApprovedAt: lastApprovedAt ? toIsoDate(lastApprovedAt) : null,
    firstSubmittedAt: toIsoDate(sorted[sorted.length - 1].createdAt),
    totalNotes: sorted.length,
    approvedNotes,
    approvedLast30Days,
    approvedLastSixMonths,
    deniedNotes,
    maybeNotes,
    openNotes,
    refundedNotes,
    offerUsedCount,
    standardPriceNotes,
    grossRevenueCents,
    refundedRevenueCents,
    netRevenueCents,
    uniquePatients,
    familySignal,
  }
}

export function buildFriendsFamilyAnalytics(
  submissions: FriendsFamilySubmissionInput[],
  referenceDate = new Date(),
  options: FriendsFamilyAnalyticsOptions = {}
): FriendsFamilyAnalytics {
  const activeSegment = options.segment ?? 'best_targets'
  const limit = Math.max(1, Math.min(options.limit ?? 200, 50000))
  const grouped = new Map<string, FriendsFamilySubmissionInput[]>()

  let offerNotesCount = 0
  let offerNetRevenueCents = 0
  for (const submission of submissions) {
    if (normalizeOfferCode(submission.offerCode) !== DOCTOR_10_OFFER_CODE) continue
    offerNotesCount += 1
    const paid = submission.paymentAmount ?? 0
    const refunded = Boolean(submission.refundedAt) || Boolean(submission.stripeRefundId)
    offerNetRevenueCents += refunded ? 0 : paid
  }

  for (const submission of submissions) {
    const customerKey = getCustomerKey(submission)
    const existing = grouped.get(customerKey)
    if (existing) {
      existing.push(submission)
    } else {
      grouped.set(customerKey, [submission])
    }
  }

  const byScore = (a: FriendsFamilyCustomerRow, b: FriendsFamilyCustomerRow) => {
    if (b.score !== a.score) return b.score - a.score
    const aApproved = a.lastApprovedAt ? new Date(a.lastApprovedAt).getTime() : 0
    const bApproved = b.lastApprovedAt ? new Date(b.lastApprovedAt).getTime() : 0
    if (bApproved !== aApproved) return bApproved - aApproved
    return new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime()
  }

  const byRecency = (a: FriendsFamilyCustomerRow, b: FriendsFamilyCustomerRow) => {
    const aApproved = a.lastApprovedAt ? new Date(a.lastApprovedAt).getTime() : 0
    const bApproved = b.lastApprovedAt ? new Date(b.lastApprovedAt).getTime() : 0
    if (bApproved !== aApproved) return bApproved - aApproved
    return new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime()
  }

  const byNotes = (a: FriendsFamilyCustomerRow, b: FriendsFamilyCustomerRow) => {
    if (b.approvedNotes !== a.approvedNotes) return b.approvedNotes - a.approvedNotes
    return byRecency(a, b)
  }

  const sortForSegment = (segment: FriendsFamilySegmentFilter) => {
    if (segment === 'all_customers') return byRecency
    if (segment === 'no_refunds') return byNotes
    return byScore
  }

  const customers = Array.from(grouped.entries())
    .map(([customerKey, customerSubmissions]) =>
      buildCustomerRow(customerKey, customerSubmissions, referenceDate)
    )
    .sort(byScore)

  const countSegment = (segment: FriendsFamilySegmentKey) =>
    customers.filter((customer) => customer.segments.includes(segment)).length

  const activeCustomers = (
    activeSegment === 'all_customers'
      ? [...customers]
      : customers.filter((customer) => customer.segments.includes(activeSegment))
  ).sort(sortForSegment(activeSegment))

  const summary: FriendsFamilyAnalyticsSummary = {
    totalCustomers: customers.length,
    bestTargets: countSegment('best_targets'),
    recentApprovals: countSegment('recent_approvals'),
    repeatCustomers: countSegment('repeat_customers'),
    noRefunds: countSegment('no_refunds'),
    familySignal: countSegment('family_signal'),
    needsReview: countSegment('needs_review'),
    refunded: countSegment('refunded'),
    offerUsed: countSegment('offer_used'),
    offerNotesCount,
    offerNetRevenueCents,
    grossRevenueCents: customers.reduce((total, customer) => total + customer.grossRevenueCents, 0),
    refundedRevenueCents: customers.reduce(
      (total, customer) => total + customer.refundedRevenueCents,
      0
    ),
    netRevenueCents: customers.reduce((total, customer) => total + customer.netRevenueCents, 0),
  }

  return {
    generatedAt: toIsoDate(referenceDate),
    summary,
    activeSegment,
    segmentTotal: activeCustomers.length,
    limit,
    customers: activeCustomers.slice(0, limit),
  }
}
