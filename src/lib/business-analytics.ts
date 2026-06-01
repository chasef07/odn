import { SubmissionStatus } from '@prisma/client'
import { normalizeOfferCode } from '@/lib/offer-codes'

export type BusinessAnalyticsRange = '30d' | '90d' | 'all'

export type BusinessAnalyticsOptions = {
  range?: BusinessAnalyticsRange
}

export type BusinessAnalyticsSubmissionInput = {
  id: string
  status: SubmissionStatus
  state: string
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: Date
  email: string
  phone: string
  offerCode: string | null
  paymentAmount: number | null
  stripeRefundId: string | null
  refundedAt: Date | null
  createdAt: Date
}

export type BusinessAnalyticsTone = 'positive' | 'warning' | 'negative' | 'neutral'

export type BusinessAnalyticsSummary = {
  range: BusinessAnalyticsRange
  rangeLabel: string
  startDate: string | null
  endDate: string
  comparisonLabel: string | null
  totalNotes: number
  paidNotes: number
  approvedNotes: number
  deniedNotes: number
  maybeNotes: number
  openNotes: number
  refundedNotes: number
  refundRate: number
  approvalRate: number
  grossRevenueCents: number
  refundedRevenueCents: number
  netRevenueCents: number
  averageNetRevenuePerPaidNoteCents: number
  totalCustomers: number
  newCustomers: number
  repeatCustomers: number
  repeatCustomerRate: number
  repeatRevenueCents: number
  threePlusNotesSixMonthsCustomers: number
  offerNotes: number
  offerNetRevenueCents: number
  netRevenueDeltaPct: number | null
  notesDeltaPct: number | null
  refundRateDeltaPoints: number | null
  repeatCustomerRateDeltaPoints: number | null
}

export type BusinessAnalyticsTrendPoint = {
  key: string
  label: string
  notes: number
  grossRevenueCents: number
  refundedRevenueCents: number
  netRevenueCents: number
}

export type BusinessAnalyticsBreakdownRow = {
  key: string
  label: string
  notes: number
  rate: number
}

export type BusinessAnalyticsStateRow = {
  state: string
  notes: number
  grossRevenueCents: number
  refundedRevenueCents: number
  netRevenueCents: number
  refundedNotes: number
  refundRate: number
}

export type BusinessAnalyticsAgeBand = {
  key: string
  label: string
  notes: number
  netRevenueCents: number
}

export type BusinessAnalyticsInsight = {
  title: string
  detail: string
  tone: BusinessAnalyticsTone
}

export type BusinessAnalytics = {
  generatedAt: string
  summary: BusinessAnalyticsSummary
  trend: BusinessAnalyticsTrendPoint[]
  outcomeBreakdown: BusinessAnalyticsBreakdownRow[]
  stateRows: BusinessAnalyticsStateRow[]
  ageBands: BusinessAnalyticsAgeBand[]
  insights: BusinessAnalyticsInsight[]
}

type AnalyticsPeriod = {
  range: BusinessAnalyticsRange
  label: string
  start: Date | null
  endExclusive: Date
  previousStart: Date | null
  previousEndExclusive: Date | null
  days: number | null
}

type PeriodMetrics = {
  totalNotes: number
  paidNotes: number
  approvedNotes: number
  deniedNotes: number
  maybeNotes: number
  openNotes: number
  refundedNotes: number
  refundRate: number
  approvalRate: number
  grossRevenueCents: number
  refundedRevenueCents: number
  netRevenueCents: number
  averageNetRevenuePerPaidNoteCents: number
  totalCustomers: number
  newCustomers: number
  repeatCustomers: number
  repeatCustomerRate: number
  repeatRevenueCents: number
  offerNotes: number
  offerNetRevenueCents: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_STATE_ROWS = 8

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})

const AGE_BANDS = [
  { key: 'under_18', label: 'Under 18', min: Number.NEGATIVE_INFINITY, max: 17 },
  { key: '18_24', label: '18-24', min: 18, max: 24 },
  { key: '25_34', label: '25-34', min: 25, max: 34 },
  { key: '35_44', label: '35-44', min: 35, max: 44 },
  { key: '45_54', label: '45-54', min: 45, max: 54 },
  { key: '55_64', label: '55-64', min: 55, max: 64 },
  { key: '65_plus', label: '65+', min: 65, max: Number.POSITIVE_INFINITY },
  { key: 'unknown', label: 'Unknown', min: null, max: null },
] as const

function toIsoDate(date: Date): string {
  return date.toISOString()
}

function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()))
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function customerKey(submission: BusinessAnalyticsSubmissionInput): string {
  const email = normalizeEmail(submission.email)
  if (email) return `email:${email}`

  const phone = normalizePhone(submission.phone)
  if (phone) return `phone:${phone}`

  return `patient:${submission.patientFirstName.toLowerCase()}:${submission.patientLastName.toLowerCase()}:${toCalendarDate(submission.patientDateOfBirth)}`
}

function isRefunded(submission: BusinessAnalyticsSubmissionInput): boolean {
  return Boolean(submission.refundedAt) || Boolean(submission.stripeRefundId)
}

function isOpenStatus(status: SubmissionStatus): boolean {
  return (
    status === SubmissionStatus.PENDING_REVIEW ||
    status === SubmissionStatus.MAYBE ||
    status === SubmissionStatus.MANUAL
  )
}

function inPeriod(
  submission: BusinessAnalyticsSubmissionInput,
  start: Date | null,
  endExclusive: Date
): boolean {
  return (!start || submission.createdAt >= start) && submission.createdAt < endExclusive
}

function buildPeriod(range: BusinessAnalyticsRange, referenceDate: Date): AnalyticsPeriod {
  const endExclusive = addUtcDays(startOfUtcDay(referenceDate), 1)

  if (range === 'all') {
    return {
      range,
      label: 'All time',
      start: null,
      endExclusive,
      previousStart: null,
      previousEndExclusive: null,
      days: null,
    }
  }

  const days = range === '90d' ? 90 : 30
  const start = addUtcDays(endExclusive, -days)

  return {
    range,
    label: `Last ${days} days`,
    start,
    endExclusive,
    previousStart: addUtcDays(start, -days),
    previousEndExclusive: start,
    days,
  }
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return numerator / denominator
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null
  }

  return ((current - previous) / Math.abs(previous)) * 100
}

function buildPeriodMetrics(
  periodSubmissions: BusinessAnalyticsSubmissionInput[],
  allSubmissions: BusinessAnalyticsSubmissionInput[],
  periodStart: Date | null
): PeriodMetrics {
  const totalNotes = periodSubmissions.length
  const paidNotes = periodSubmissions.filter(
    (submission) => (submission.paymentAmount ?? 0) > 0
  ).length
  const approvedNotes = periodSubmissions.filter(
    (submission) => submission.status === SubmissionStatus.APPROVED
  ).length
  const deniedNotes = periodSubmissions.filter(
    (submission) => submission.status === SubmissionStatus.DENIED
  ).length
  const maybeNotes = periodSubmissions.filter(
    (submission) => submission.status === SubmissionStatus.MAYBE
  ).length
  const openNotes = periodSubmissions.filter((submission) => isOpenStatus(submission.status)).length
  const refundedNotes = periodSubmissions.filter(isRefunded).length
  const grossRevenueCents = periodSubmissions.reduce(
    (total, submission) => total + (submission.paymentAmount ?? 0),
    0
  )
  const refundedRevenueCents = periodSubmissions
    .filter(isRefunded)
    .reduce((total, submission) => total + (submission.paymentAmount ?? 0), 0)
  const netRevenueCents = grossRevenueCents - refundedRevenueCents

  const previousCustomerKeys = new Set(
    periodStart
      ? allSubmissions
          .filter((submission) => submission.createdAt < periodStart)
          .map((submission) => customerKey(submission))
      : []
  )
  const periodCustomerGroups = new Map<string, BusinessAnalyticsSubmissionInput[]>()

  for (const submission of periodSubmissions) {
    const key = customerKey(submission)
    const existing = periodCustomerGroups.get(key)
    if (existing) {
      existing.push(submission)
    } else {
      periodCustomerGroups.set(key, [submission])
    }
  }

  let newCustomers = 0
  let repeatCustomers = 0
  let repeatRevenueCents = 0

  for (const [key, submissions] of periodCustomerGroups) {
    const hasEarlierHistory = previousCustomerKeys.has(key)
    const isRepeat = hasEarlierHistory || submissions.length >= 2

    if (isRepeat) {
      repeatCustomers += 1
      repeatRevenueCents += submissions.reduce(
        (total, submission) =>
          total + (isRefunded(submission) ? 0 : (submission.paymentAmount ?? 0)),
        0
      )
    } else {
      newCustomers += 1
    }
  }

  const offerSubmissions = periodSubmissions.filter((submission) =>
    Boolean(normalizeOfferCode(submission.offerCode))
  )
  const offerNotes = offerSubmissions.length
  const offerNetRevenueCents = offerSubmissions.reduce(
    (total, submission) => total + (isRefunded(submission) ? 0 : (submission.paymentAmount ?? 0)),
    0
  )

  return {
    totalNotes,
    paidNotes,
    approvedNotes,
    deniedNotes,
    maybeNotes,
    openNotes,
    refundedNotes,
    refundRate: safeRate(refundedNotes, totalNotes),
    approvalRate: safeRate(approvedNotes, totalNotes),
    grossRevenueCents,
    refundedRevenueCents,
    netRevenueCents,
    averageNetRevenuePerPaidNoteCents: paidNotes ? Math.round(netRevenueCents / paidNotes) : 0,
    totalCustomers: periodCustomerGroups.size,
    newCustomers,
    repeatCustomers,
    repeatCustomerRate: safeRate(repeatCustomers, periodCustomerGroups.size),
    repeatRevenueCents,
    offerNotes,
    offerNetRevenueCents,
  }
}

function buildTrend(
  periodSubmissions: BusinessAnalyticsSubmissionInput[],
  period: AnalyticsPeriod
): BusinessAnalyticsTrendPoint[] {
  if (period.range !== 'all' && period.start) {
    const buckets = new Map<string, BusinessAnalyticsTrendPoint>()

    for (let cursor = period.start; cursor < period.endExclusive; cursor = addUtcDays(cursor, 1)) {
      const key = toCalendarDate(cursor)
      buckets.set(key, {
        key,
        label: dayLabelFormatter.format(cursor),
        notes: 0,
        grossRevenueCents: 0,
        refundedRevenueCents: 0,
        netRevenueCents: 0,
      })
    }

    for (const submission of periodSubmissions) {
      const key = toCalendarDate(submission.createdAt)
      const bucket = buckets.get(key)
      if (!bucket) continue

      const paymentAmount = submission.paymentAmount ?? 0
      const refundedAmount = isRefunded(submission) ? paymentAmount : 0

      bucket.notes += 1
      bucket.grossRevenueCents += paymentAmount
      bucket.refundedRevenueCents += refundedAmount
      bucket.netRevenueCents += paymentAmount - refundedAmount
    }

    return Array.from(buckets.values())
  }

  if (periodSubmissions.length === 0) {
    return []
  }

  const sorted = [...periodSubmissions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )
  const firstMonth = startOfUtcMonth(sorted[0].createdAt)
  const lastMonthEnd = addUtcMonth(startOfUtcMonth(period.endExclusive))
  const buckets = new Map<string, BusinessAnalyticsTrendPoint>()

  for (let cursor = firstMonth; cursor < lastMonthEnd; cursor = addUtcMonth(cursor)) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`
    buckets.set(key, {
      key,
      label: monthLabelFormatter.format(cursor),
      notes: 0,
      grossRevenueCents: 0,
      refundedRevenueCents: 0,
      netRevenueCents: 0,
    })
  }

  for (const submission of periodSubmissions) {
    const createdAt = submission.createdAt
    const key = `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(key)
    if (!bucket) continue

    const paymentAmount = submission.paymentAmount ?? 0
    const refundedAmount = isRefunded(submission) ? paymentAmount : 0

    bucket.notes += 1
    bucket.grossRevenueCents += paymentAmount
    bucket.refundedRevenueCents += refundedAmount
    bucket.netRevenueCents += paymentAmount - refundedAmount
  }

  return Array.from(buckets.values())
}

function buildOutcomeBreakdown(
  periodSubmissions: BusinessAnalyticsSubmissionInput[]
): BusinessAnalyticsBreakdownRow[] {
  const totalNotes = periodSubmissions.length
  const rows: BusinessAnalyticsBreakdownRow[] = [
    { key: 'approved', label: 'Approved', notes: 0, rate: 0 },
    { key: 'denied', label: 'Denied', notes: 0, rate: 0 },
    { key: 'maybe', label: 'Maybe', notes: 0, rate: 0 },
    { key: 'pending', label: 'Pending', notes: 0, rate: 0 },
    { key: 'manual', label: 'Manual', notes: 0, rate: 0 },
  ]

  for (const submission of periodSubmissions) {
    const key = outcomeKey(submission.status)
    const row = rows.find((candidate) => candidate.key === key)
    if (row) row.notes += 1
  }

  return rows.map((row) => ({ ...row, rate: safeRate(row.notes, totalNotes) }))
}

function outcomeKey(status: SubmissionStatus): BusinessAnalyticsBreakdownRow['key'] {
  switch (status) {
    case SubmissionStatus.APPROVED:
      return 'approved'
    case SubmissionStatus.DENIED:
      return 'denied'
    case SubmissionStatus.MAYBE:
      return 'maybe'
    case SubmissionStatus.MANUAL:
      return 'manual'
    case SubmissionStatus.PENDING_REVIEW:
    default:
      return 'pending'
  }
}

function buildStateRows(
  submissions: BusinessAnalyticsSubmissionInput[]
): BusinessAnalyticsStateRow[] {
  const rows = new Map<string, BusinessAnalyticsStateRow>()

  for (const submission of submissions) {
    const state = submission.state.trim() || 'Unknown'
    const existing =
      rows.get(state) ??
      ({
        state,
        notes: 0,
        grossRevenueCents: 0,
        refundedRevenueCents: 0,
        netRevenueCents: 0,
        refundedNotes: 0,
        refundRate: 0,
      } satisfies BusinessAnalyticsStateRow)
    const paymentAmount = submission.paymentAmount ?? 0
    const refundedAmount = isRefunded(submission) ? paymentAmount : 0

    existing.notes += 1
    existing.grossRevenueCents += paymentAmount
    existing.refundedRevenueCents += refundedAmount
    existing.netRevenueCents += paymentAmount - refundedAmount
    existing.refundedNotes += isRefunded(submission) ? 1 : 0
    rows.set(state, existing)
  }

  return Array.from(rows.values())
    .map((row) => ({ ...row, refundRate: safeRate(row.refundedNotes, row.notes) }))
    .sort((a, b) => {
      if (b.netRevenueCents !== a.netRevenueCents) return b.netRevenueCents - a.netRevenueCents
      return b.notes - a.notes
    })
    .slice(0, MAX_STATE_ROWS)
}

function ageAt(dateOfBirth: Date, referenceDate: Date): number | null {
  if (Number.isNaN(dateOfBirth.getTime())) return null

  let age = referenceDate.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const referenceMonth = referenceDate.getUTCMonth()
  const birthMonth = dateOfBirth.getUTCMonth()

  if (
    referenceMonth < birthMonth ||
    (referenceMonth === birthMonth && referenceDate.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1
  }

  return age
}

function ageBandKey(age: number | null): (typeof AGE_BANDS)[number]['key'] {
  if (age === null) return 'unknown'

  const band = AGE_BANDS.find(
    (candidate) =>
      candidate.min !== null &&
      candidate.max !== null &&
      age >= candidate.min &&
      age <= candidate.max
  )

  return band?.key ?? 'unknown'
}

function buildAgeBands(
  submissions: BusinessAnalyticsSubmissionInput[],
  referenceDate: Date
): BusinessAnalyticsAgeBand[] {
  const rows = new Map<string, BusinessAnalyticsAgeBand>()

  for (const band of AGE_BANDS) {
    rows.set(band.key, {
      key: band.key,
      label: band.label,
      notes: 0,
      netRevenueCents: 0,
    })
  }

  for (const submission of submissions) {
    const key = ageBandKey(ageAt(submission.patientDateOfBirth, referenceDate))
    const row = rows.get(key)
    if (!row) continue

    const paymentAmount = submission.paymentAmount ?? 0
    row.notes += 1
    row.netRevenueCents += isRefunded(submission) ? 0 : paymentAmount
  }

  return Array.from(rows.values()).filter((row) => row.notes > 0)
}

function countThreePlusNotesSixMonths(
  submissions: BusinessAnalyticsSubmissionInput[],
  referenceDate: Date
): number {
  const sixMonthsAgo = addUtcMonths(referenceDate, -6)
  const groups = new Map<string, number>()

  for (const submission of submissions) {
    if (submission.createdAt < sixMonthsAgo || submission.createdAt > referenceDate) continue

    const key = customerKey(submission)
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }

  return Array.from(groups.values()).filter((count) => count >= 3).length
}

function currencyText(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function percentText(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function deltaText(value: number | null): string | null {
  if (value === null) return null
  const rounded = Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)
  return `${value >= 0 ? '+' : '-'}${rounded}%`
}

function buildInsights(
  summary: BusinessAnalyticsSummary,
  stateRows: BusinessAnalyticsStateRow[]
): BusinessAnalyticsInsight[] {
  const insights: BusinessAnalyticsInsight[] = []
  const netRevenueDelta = deltaText(summary.netRevenueDeltaPct)

  if (netRevenueDelta) {
    insights.push({
      title:
        summary.netRevenueDeltaPct !== null && summary.netRevenueDeltaPct >= 0
          ? 'Revenue up'
          : 'Revenue down',
      detail: `${netRevenueDelta} vs ${summary.comparisonLabel ?? 'previous period'} at ${currencyText(summary.netRevenueCents)} net.`,
      tone:
        summary.netRevenueDeltaPct !== null && summary.netRevenueDeltaPct >= 0
          ? 'positive'
          : 'warning',
    })
  } else if (summary.netRevenueCents > 0) {
    insights.push({
      title: 'Revenue baseline',
      detail: `${currencyText(summary.netRevenueCents)} net revenue with no prior-period baseline.`,
      tone: 'neutral',
    })
  }

  if (summary.refundRateDeltaPoints !== null) {
    const delta = summary.refundRateDeltaPoints
    const points = Math.abs(delta * 100).toFixed(1)

    if (Math.abs(delta) < 0.0001) {
      insights.push({
        title: 'Refund rate steady',
        detail: `${percentText(summary.refundRate)} refund rate, unchanged from ${
          summary.comparisonLabel ?? 'previous period'
        }.`,
        tone: 'neutral',
      })
    } else {
      const improved = delta < 0

      insights.push({
        title: improved ? 'Refund rate improved' : 'Refund rate watch',
        detail: `${percentText(summary.refundRate)} refund rate, ${points} points ${
          improved ? 'lower' : 'higher'
        } than ${summary.comparisonLabel ?? 'previous period'}.`,
        tone: improved ? 'positive' : delta > 0.02 ? 'negative' : 'neutral',
      })
    }
  }

  insights.push({
    title: 'Repeat base',
    detail: `${summary.repeatCustomers} repeat customers generated ${currencyText(
      summary.repeatRevenueCents
    )} net revenue.`,
    tone: summary.repeatCustomerRate >= 0.3 ? 'positive' : 'neutral',
  })

  const topState = stateRows[0]
  if (topState) {
    insights.push({
      title: `${topState.state} leads`,
      detail: `${currencyText(topState.netRevenueCents)} net across ${topState.notes} notes, ${percentText(
        topState.refundRate
      )} refund rate.`,
      tone: topState.refundRate > 0.08 ? 'warning' : 'positive',
    })
  }

  if (summary.openNotes > 0) {
    insights.push({
      title: 'Open review load',
      detail: `${summary.openNotes} notes are still pending, maybe, or manual in this range.`,
      tone: summary.openNotes > 5 ? 'warning' : 'neutral',
    })
  }

  return insights.slice(0, 4)
}

export function buildBusinessAnalytics(
  submissions: BusinessAnalyticsSubmissionInput[],
  referenceDate = new Date(),
  options: BusinessAnalyticsOptions = {}
): BusinessAnalytics {
  const range = options.range ?? '30d'
  const period = buildPeriod(range, referenceDate)
  const allSubmissions = submissions.filter(
    (submission) => submission.createdAt < period.endExclusive
  )
  const periodSubmissions = allSubmissions.filter((submission) =>
    inPeriod(submission, period.start, period.endExclusive)
  )
  const previousStart = period.previousStart
  const previousEndExclusive = period.previousEndExclusive
  const previousSubmissions =
    previousStart && previousEndExclusive
      ? allSubmissions.filter((submission) =>
          inPeriod(submission, previousStart, previousEndExclusive)
        )
      : []

  const currentMetrics = buildPeriodMetrics(periodSubmissions, allSubmissions, period.start)
  const previousMetrics = buildPeriodMetrics(previousSubmissions, allSubmissions, previousStart)
  const stateRows = buildStateRows(allSubmissions)
  const hasPreviousRefundRateBaseline = Boolean(previousStart && previousMetrics.totalNotes > 0)
  const hasPreviousRepeatRateBaseline = Boolean(previousStart && previousMetrics.totalCustomers > 0)
  const summary: BusinessAnalyticsSummary = {
    range,
    rangeLabel: period.label,
    startDate: period.start ? toIsoDate(period.start) : null,
    endDate: toIsoDate(addUtcDays(period.endExclusive, -1)),
    comparisonLabel: period.days ? `previous ${period.days} days` : null,
    ...currentMetrics,
    threePlusNotesSixMonthsCustomers: countThreePlusNotesSixMonths(allSubmissions, referenceDate),
    netRevenueDeltaPct: previousStart
      ? percentDelta(currentMetrics.netRevenueCents, previousMetrics.netRevenueCents)
      : null,
    notesDeltaPct: previousStart
      ? percentDelta(currentMetrics.totalNotes, previousMetrics.totalNotes)
      : null,
    refundRateDeltaPoints: hasPreviousRefundRateBaseline
      ? currentMetrics.refundRate - previousMetrics.refundRate
      : null,
    repeatCustomerRateDeltaPoints: hasPreviousRepeatRateBaseline
      ? currentMetrics.repeatCustomerRate - previousMetrics.repeatCustomerRate
      : null,
  }

  return {
    generatedAt: toIsoDate(referenceDate),
    summary,
    trend: buildTrend(periodSubmissions, period),
    outcomeBreakdown: buildOutcomeBreakdown(periodSubmissions),
    stateRows,
    ageBands: buildAgeBands(allSubmissions, referenceDate),
    insights: buildInsights(summary, stateRows),
  }
}
