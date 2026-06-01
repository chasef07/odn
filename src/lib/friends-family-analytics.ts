import { SubmissionStatus } from '@prisma/client'
import { FRIENDS_FAMILY_OFFER_CODE, normalizeOfferCode } from '@/lib/offer-codes'

export type FriendsFamilySegmentKey =
  | 'best_targets'
  | 'recent_approvals'
  | 'repeat_customers'
  | 'lapsed_good'
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
  lapsedGood: number
  familySignal: number
  needsReview: number
  refunded: number
  offerUsed: number
  targetableFullPriceCustomers: number
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

const MS_PER_DAY = 24 * 60 * 60 * 1000

function toIsoDate(date: Date): string {
  return date.toISOString()
}

function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function getFriendsFamilyCustomerKey(submission: FriendsFamilySubmissionInput): string {
  const email = normalizeEmail(submission.email)
  if (email) {
    return `email:${email}`
  }

  const phone = normalizePhone(submission.phone)
  if (phone) {
    return `phone:${phone}`
  }

  return `patient:${submission.patientFirstName.toLowerCase()}:${submission.patientLastName.toLowerCase()}:${toCalendarDate(submission.patientDateOfBirth)}`
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

function isOpenStatus(status: SubmissionStatus): boolean {
  return (
    status === SubmissionStatus.PENDING_REVIEW ||
    status === SubmissionStatus.MAYBE ||
    status === SubmissionStatus.MANUAL
  )
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
  const sixMonthsAgo = new Date(referenceDate)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

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
    (submission) => normalizeOfferCode(submission.offerCode) === FRIENDS_FAMILY_OFFER_CODE
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
        `${submission.patientFirstName.toLowerCase()}:${submission.patientLastName.toLowerCase()}:${toCalendarDate(submission.patientDateOfBirth)}`
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

  const reasons: FriendsFamilyReason[] = []
  const scoreFactors: FriendsFamilyScoreFactor[] = []
  let score = 0

  if (approvedNotes > 0) {
    score += addFactor(scoreFactors, reasons, 'Successful approved history', 35, 'positive')
  }

  if (approvedLast30Days > 0) {
    score += addFactor(scoreFactors, reasons, 'Approved in last 30 days', 25, 'positive')
  }

  if (approvedNotes >= 2) {
    score += addFactor(scoreFactors, reasons, 'Repeat successful customer', 18, 'positive')
  }

  if (approvedLastSixMonths >= 3) {
    score += addFactor(scoreFactors, reasons, '3+ approved notes in 6 months', 16, 'positive')
  } else if (approvedLastSixMonths >= 2) {
    score += addFactor(scoreFactors, reasons, '2 approved notes in 6 months', 8, 'positive')
  }

  if (familySignal) {
    score += addFactor(scoreFactors, reasons, 'Family or caregiver pattern', 10, 'positive')
  }

  if (refundedNotes === 0) {
    score += addFactor(scoreFactors, reasons, 'No refund history', 12, 'positive')
  } else {
    score += addFactor(scoreFactors, reasons, 'Refund history', -45, 'negative')
  }

  if (deniedNotes === 0) {
    score += addFactor(scoreFactors, reasons, 'No denial history', 8, 'positive')
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
    score += addFactor(scoreFactors, reasons, 'Already used friends20', -10, 'neutral')
  } else if (standardPriceNotes > 0) {
    score += addFactor(scoreFactors, reasons, 'Paid standard price before', 8, 'positive')
  }

  const finalScore = clampScore(score)
  const priority = priorityFromScore(finalScore, refundedNotes > 0, openNotes > 0)
  const segments: FriendsFamilySegmentKey[] = []

  if (
    refundedNotes === 0 &&
    openNotes === 0 &&
    offerUsedCount === 0 &&
    approvedNotes > 0 &&
    finalScore >= 55
  ) {
    segments.push('best_targets')
  }
  if (approvedLast30Days > 0 && refundedNotes === 0) segments.push('recent_approvals')
  if (approvedNotes >= 2) segments.push('repeat_customers')
  if (approvedNotes > 0 && approvedLast30Days === 0 && refundedNotes === 0 && openNotes === 0) {
    segments.push('lapsed_good')
  }
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
      firstDayOff: toCalendarDate(submission.firstDayOff),
      lastDayOff: toCalendarDate(submission.lastDayOff),
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
  const limit = Math.max(1, Math.min(options.limit ?? 50, 250))
  const grouped = new Map<string, FriendsFamilySubmissionInput[]>()

  for (const submission of submissions) {
    const customerKey = getFriendsFamilyCustomerKey(submission)
    const existing = grouped.get(customerKey)
    if (existing) {
      existing.push(submission)
    } else {
      grouped.set(customerKey, [submission])
    }
  }

  const customers = Array.from(grouped.entries())
    .map(([customerKey, customerSubmissions]) =>
      buildCustomerSegment(customerKey, customerSubmissions, referenceDate)
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aApproved = a.lastApprovedAt ? new Date(a.lastApprovedAt).getTime() : 0
      const bApproved = b.lastApprovedAt ? new Date(b.lastApprovedAt).getTime() : 0
      if (bApproved !== aApproved) return bApproved - aApproved
      return new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime()
    })

  const countSegment = (segment: FriendsFamilySegmentKey) =>
    customers.filter((customer) => customer.segments.includes(segment)).length

  const activeCustomers =
    activeSegment === 'all_customers'
      ? customers
      : customers.filter((customer) => customer.segments.includes(activeSegment))

  const summary: FriendsFamilyAnalyticsSummary = {
    totalCustomers: customers.length,
    bestTargets: countSegment('best_targets'),
    recentApprovals: countSegment('recent_approvals'),
    repeatCustomers: countSegment('repeat_customers'),
    lapsedGood: countSegment('lapsed_good'),
    familySignal: countSegment('family_signal'),
    needsReview: countSegment('needs_review'),
    refunded: countSegment('refunded'),
    offerUsed: countSegment('offer_used'),
    targetableFullPriceCustomers: customers.filter(
      (customer) =>
        customer.segments.includes('best_targets') &&
        customer.standardPriceNotes > 0 &&
        customer.offerUsedCount === 0
    ).length,
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
