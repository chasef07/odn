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
  notePurpose: string
  firstDayOff: Date
  lastDayOff: Date
  denialReason: string | null
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

export type FriendsFamilyScoreFactor = {
  label: string
  value: number
}

export type FriendsFamilyTimelineEntry = {
  id: string
  status: SubmissionStatus
  notePurpose: string
  submittedAt: string
  reviewedAt: string | null
  firstDayOff: string
  lastDayOff: string
  denialReason: string | null
  maybeReason: string | null
  refunded: boolean
  offerCode: string | null
  paymentAmount: number | null
}

export type FriendsFamilyCustomerSegment = {
  customerKey: string
  displayName: string
  email: string
  phone: string
  score: number
  priority: FriendsFamilyPriority
  segments: FriendsFamilySegmentKey[]
  reasons: FriendsFamilyReason[]
  scoreFactors: FriendsFamilyScoreFactor[]
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
  timeline: FriendsFamilyTimelineEntry[]
}

export type FriendsFamilyCustomerRow = Omit<
  FriendsFamilyCustomerSegment,
  'scoreFactors' | 'timeline'
>

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

export function getFriendsFamilyCustomerKey(submission: FriendsFamilySubmissionInput): string {
  return getCustomerKey(submission)
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

function addFactor(
  factors: FriendsFamilyScoreFactor[],
  reasons: FriendsFamilyReason[],
  label: string,
  value: number,
  tone: FriendsFamilyTone
): number {
  factors.push({ label, value })
  reasons.push({ label, tone })
  return value
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

function buildCustomerSegment(
  customerKey: string,
  submissions: FriendsFamilySubmissionInput[],
  referenceDate: Date
): FriendsFamilyCustomerSegment {
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

  const reasons: FriendsFamilyReason[] = []
  const scoreFactors: FriendsFamilyScoreFactor[] = []
  let score = 0

  if (approvedNotes >= 2) {
    score += addFactor(scoreFactors, reasons, 'Repeat successful customer', 30, 'positive')
  }
  if (approvedNotes >= 3) {
    score += addFactor(scoreFactors, reasons, '3+ approved notes', 10, 'positive')
  }

  if (daysSinceLastApproved !== null) {
    if (daysSinceLastApproved < 14) {
      score += addFactor(scoreFactors, reasons, 'Too recent to discount', -20, 'warning')
    } else if (daysSinceLastApproved < 30) {
      score += addFactor(scoreFactors, reasons, 'Recently active', 5, 'positive')
    } else if (daysSinceLastApproved <= 90) {
      score += addFactor(scoreFactors, reasons, 'Sweet spot recency', 25, 'positive')
    } else if (daysSinceLastApproved <= 180) {
      score += addFactor(scoreFactors, reasons, 'Cooling off', -5, 'warning')
    } else {
      score += addFactor(scoreFactors, reasons, 'Cold lead', -20, 'warning')
    }
  }

  if (approvedNotes === 0) {
    score += addFactor(scoreFactors, reasons, 'No approved history', -15, 'warning')
  }

  if (familySignal) {
    score += addFactor(scoreFactors, reasons, 'Family or caregiver pattern', 8, 'positive')
  }

  if (refundedNotes === 0) {
    score += addFactor(scoreFactors, reasons, 'No refund history', 12, 'positive')
  } else {
    score += addFactor(scoreFactors, reasons, 'Refund history', -45, 'negative')
  }

  if (deniedNotes === 0) {
    score += addFactor(scoreFactors, reasons, 'No denial history', 5, 'positive')
  } else {
    score += addFactor(
      scoreFactors,
      reasons,
      `${deniedNotes} prior ${deniedNotes === 1 ? 'denial' : 'denials'}`,
      Math.max(-20, -8 * deniedNotes),
      'warning'
    )
  }

  if (maybeNotes > 0) {
    score += addFactor(scoreFactors, reasons, 'Maybe review history', -5, 'warning')
  }

  if (openNotes > 0) {
    score += addFactor(scoreFactors, reasons, 'Open case needs resolution', -30, 'warning')
  }

  if (offerUsedCount > 0) {
    score += addFactor(scoreFactors, reasons, 'Already used doctor10', -25, 'warning')
  } else if (standardPriceNotes > 0) {
    score += addFactor(scoreFactors, reasons, 'Paid standard price before', 8, 'positive')
  }

  const finalScore = clampScore(score)
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
    scoreFactors,
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
    timeline: sorted.map((submission) => ({
      id: submission.id,
      status: submission.status,
      notePurpose: submission.notePurpose,
      submittedAt: toIsoDate(submission.createdAt),
      reviewedAt: submission.reviewedAt ? toIsoDate(submission.reviewedAt) : null,
      firstDayOff: dateOnlyFromUtcDate(submission.firstDayOff),
      lastDayOff: dateOnlyFromUtcDate(submission.lastDayOff),
      denialReason: submission.denialReason,
      maybeReason: submission.maybeReason,
      refunded: Boolean(submission.refundedAt) || Boolean(submission.stripeRefundId),
      offerCode: normalizeOfferCode(submission.offerCode),
      paymentAmount: submission.paymentAmount,
    })),
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
    const customerKey = getFriendsFamilyCustomerKey(submission)
    const existing = grouped.get(customerKey)
    if (existing) {
      existing.push(submission)
    } else {
      grouped.set(customerKey, [submission])
    }
  }

  const byScore = (a: FriendsFamilyCustomerSegment, b: FriendsFamilyCustomerSegment) => {
    if (b.score !== a.score) return b.score - a.score
    const aApproved = a.lastApprovedAt ? new Date(a.lastApprovedAt).getTime() : 0
    const bApproved = b.lastApprovedAt ? new Date(b.lastApprovedAt).getTime() : 0
    if (bApproved !== aApproved) return bApproved - aApproved
    return new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime()
  }

  const byRecency = (a: FriendsFamilyCustomerSegment, b: FriendsFamilyCustomerSegment) => {
    const aApproved = a.lastApprovedAt ? new Date(a.lastApprovedAt).getTime() : 0
    const bApproved = b.lastApprovedAt ? new Date(b.lastApprovedAt).getTime() : 0
    if (bApproved !== aApproved) return bApproved - aApproved
    return new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime()
  }

  const byNotes = (a: FriendsFamilyCustomerSegment, b: FriendsFamilyCustomerSegment) => {
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
      buildCustomerSegment(customerKey, customerSubmissions, referenceDate)
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
    customers: activeCustomers
      .slice(0, limit)
      .map(({ scoreFactors, timeline, ...customer }) => customer),
  }
}

export function buildFriendsFamilyCustomerDetail(
  submissions: FriendsFamilySubmissionInput[],
  customerKey: string,
  referenceDate = new Date()
): FriendsFamilyCustomerSegment | null {
  const matchingSubmissions = submissions.filter(
    (submission) => getFriendsFamilyCustomerKey(submission) === customerKey
  )

  if (matchingSubmissions.length === 0) {
    return null
  }

  return buildCustomerSegment(customerKey, matchingSubmissions, referenceDate)
}
