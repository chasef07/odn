'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  RotateCcw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { getFriendsFamilyAnalytics, getFriendsFamilyCustomerDetail } from '@/app/admin/actions'
import { cn } from '@/lib/utils'
import type {
  FriendsFamilyAnalytics,
  FriendsFamilyCustomerRow,
  FriendsFamilyCustomerSegment,
  FriendsFamilySegmentFilter,
  FriendsFamilyPriority,
  FriendsFamilySegmentKey,
  FriendsFamilyTone,
} from '@/lib/friends-family-analytics'

const CUSTOMER_LIMIT = 50

type SegmentTabKey = FriendsFamilySegmentFilter

type SegmentTab = {
  key: SegmentTabKey
  label: string
  description: string
}

const SEGMENT_TABS: SegmentTab[] = [
  {
    key: 'best_targets',
    label: 'Best Targets',
    description: 'Clean successful history, no refunds, no open cases, no offer used.',
  },
  {
    key: 'recent_approvals',
    label: 'Recent Approvals',
    description: 'Customers approved in the last 30 days.',
  },
  {
    key: 'repeat_customers',
    label: 'Repeat Customers',
    description: 'Customers with multiple successful approved notes.',
  },
  {
    key: 'lapsed_good',
    label: 'Lapsed Good',
    description: 'Approved before, clean history, no approval in the last 30 days.',
  },
  {
    key: 'family_signal',
    label: 'Family Signal',
    description: 'Caregiver submissions or multiple patients under one contact.',
  },
  {
    key: 'needs_review',
    label: 'Needs Review',
    description: 'Eligible customers with denials, maybes, or open cases lowering confidence.',
  },
  {
    key: 'refunded',
    label: 'Refunded',
    description: 'Separated from recommendations for cleaner targeting.',
  },
  {
    key: 'offer_used',
    label: 'Offer Used',
    description: 'Customers who already used the friends20 offer.',
  },
  {
    key: 'all_customers',
    label: 'All Customers',
    description: 'Every grouped customer contact in the database.',
  },
]

const PRIORITY_LABELS: Record<FriendsFamilyPriority, string> = {
  HIGH_PRIORITY: 'High Priority',
  GOOD_TARGET: 'Good Target',
  LOWER_PRIORITY: 'Lower Priority',
  HOLD: 'Hold',
  REFUND_HISTORY: 'Refund History',
  NEEDS_REVIEW: 'Needs Review',
}

const NOTE_PURPOSE_LABELS: Record<string, string> = {
  work: 'Work',
  school: 'School',
  both: 'Work & School',
  travel: 'Travel',
  other: 'Other',
}

const toneClasses: Record<FriendsFamilyTone, string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  negative: 'border-red-200 bg-red-50 text-red-800',
  neutral: 'border-gray-200 bg-gray-50 text-gray-700',
}

const priorityClasses: Record<FriendsFamilyPriority, string> = {
  HIGH_PRIORITY: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  GOOD_TARGET: 'border-blue-200 bg-blue-50 text-blue-800',
  LOWER_PRIORITY: 'border-slate-200 bg-slate-50 text-slate-700',
  HOLD: 'border-amber-200 bg-amber-50 text-amber-800',
  REFUND_HISTORY: 'border-red-200 bg-red-50 text-red-800',
  NEEDS_REVIEW: 'border-gray-200 bg-gray-50 text-gray-700',
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'No approval'

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [year, month, day] = isoDate.split('-').map(Number)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)))
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoDate))
}

function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

function priorityRank(priority: FriendsFamilyPriority): number {
  const ranks: Record<FriendsFamilyPriority, number> = {
    HIGH_PRIORITY: 1,
    GOOD_TARGET: 2,
    LOWER_PRIORITY: 3,
    HOLD: 4,
    NEEDS_REVIEW: 5,
    REFUND_HISTORY: 6,
  }

  return ranks[priority]
}

function getSegmentCount(analytics: FriendsFamilyAnalytics, key: SegmentTabKey): number {
  switch (key) {
    case 'all_customers':
      return analytics.summary.totalCustomers
    case 'best_targets':
      return analytics.summary.bestTargets
    case 'recent_approvals':
      return analytics.summary.recentApprovals
    case 'repeat_customers':
      return analytics.summary.repeatCustomers
    case 'lapsed_good':
      return analytics.summary.lapsedGood
    case 'family_signal':
      return analytics.summary.familySignal
    case 'needs_review':
      return analytics.summary.needsReview
    case 'refunded':
      return analytics.summary.refunded
    case 'offer_used':
      return analytics.summary.offerUsed
  }
}

function SignalChip({ label, tone }: { label: string; tone: FriendsFamilyTone }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        toneClasses[tone]
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}

function PriorityBadge({ priority }: { priority: FriendsFamilyPriority }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        priorityClasses[priority]
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

function SummaryTile({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: number | string
  detail: string
  icon: typeof ShieldCheck
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-gray-950">{value}</div>
          <div className="text-sm font-medium text-gray-900">{label}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">{detail}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function CustomerReasons({ customer }: { customer: FriendsFamilyCustomerRow }) {
  const visibleReasons = customer.reasons.slice(0, 4)
  const hiddenCount = customer.reasons.length - visibleReasons.length

  return (
    <div className="flex max-w-lg flex-wrap gap-1.5">
      {visibleReasons.map((reason) => (
        <SignalChip key={`${customer.customerKey}-${reason.label}`} {...reason} />
      ))}
      {hiddenCount > 0 && <SignalChip label={`+${hiddenCount} more`} tone="neutral" />}
    </div>
  )
}

function issueText(customer: FriendsFamilyCustomerRow): string {
  const parts = [
    `${customer.refundedNotes} refund${customer.refundedNotes === 1 ? '' : 's'}`,
    `${customer.deniedNotes} denial${customer.deniedNotes === 1 ? '' : 's'}`,
    `${customer.maybeNotes} maybe${customer.maybeNotes === 1 ? '' : 's'}`,
  ]

  if (customer.openNotes > 0) {
    parts.push(`${customer.openNotes} open`)
  }

  return parts.join(' / ')
}

function CustomerDetailDialog({
  customer,
  onClose,
}: {
  customer: FriendsFamilyCustomerSegment | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(customer)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
        {customer && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3">
                {customer.displayName}
                <PriorityBadge priority={customer.priority} />
              </DialogTitle>
              <DialogDescription>
                {customer.email} {customer.phone ? `| ${customer.phone}` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Score</div>
                  <div className="mt-1 text-2xl font-bold text-gray-950">{customer.score}</div>
                </div>
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Approved</div>
                  <div className="mt-1 text-2xl font-bold text-gray-950">
                    {customer.approvedNotes}
                  </div>
                </div>
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Last Approved</div>
                  <div className="mt-2 text-sm font-semibold text-gray-950">
                    {formatDate(customer.lastApprovedAt)}
                  </div>
                </div>
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Net Revenue</div>
                  <div className="mt-1 text-2xl font-bold text-gray-950">
                    {formatCurrency(customer.netRevenueCents)}
                  </div>
                  {customer.refundedRevenueCents > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      {formatCurrency(customer.refundedRevenueCents)} refunded
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <section className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-950">Why this ranking</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Positive signals raise priority. Refunds and open cases separate the customer
                      from the clean target list.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {customer.scoreFactors.map((factor) => (
                      <div
                        key={`${customer.customerKey}-${factor.label}`}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      >
                        <span className="text-sm text-gray-700">{factor.label}</span>
                        <span
                          className={cn(
                            'text-sm font-semibold',
                            factor.value >= 0 ? 'text-emerald-700' : 'text-red-700'
                          )}
                        >
                          {factor.value >= 0 ? '+' : ''}
                          {factor.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-950">Submission timeline</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {customer.totalNotes} total notes across {customer.uniquePatients}{' '}
                      {customer.uniquePatients === 1 ? 'patient' : 'patients'}.
                    </p>
                  </div>
                  <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                    {customer.timeline.map((entry) => (
                      <div key={entry.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={entry.status} />
                            {entry.refunded && <SignalChip label="Refunded" tone="negative" />}
                            {entry.offerCode && (
                              <SignalChip label={`Offer: ${entry.offerCode}`} tone="neutral" />
                            )}
                          </div>
                          <Link href={`/admin/search/${entry.id}`}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                          <div>
                            <span className="text-gray-400">Submitted: </span>
                            {formatDateTime(entry.submittedAt)}
                          </div>
                          <div>
                            <span className="text-gray-400">Dates: </span>
                            {formatDate(entry.firstDayOff)} - {formatDate(entry.lastDayOff)}
                          </div>
                          <div>
                            <span className="text-gray-400">Type: </span>
                            {NOTE_PURPOSE_LABELS[entry.notePurpose] || entry.notePurpose}
                          </div>
                          <div>
                            <span className="text-gray-400">Paid: </span>
                            {entry.paymentAmount ? formatCurrency(entry.paymentAmount) : 'N/A'}
                          </div>
                        </div>
                        {(entry.denialReason || entry.maybeReason) && (
                          <div className="mt-2 text-xs text-amber-700">
                            {entry.denialReason && `Denial: ${entry.denialReason}`}
                            {entry.denialReason && entry.maybeReason ? ' | ' : ''}
                            {entry.maybeReason && `Maybe: ${entry.maybeReason}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function FriendsFamilyAnalyticsDashboard({
  analytics,
}: {
  analytics: FriendsFamilyAnalytics
}) {
  const [currentAnalytics, setCurrentAnalytics] = useState(analytics)
  const [activeSegment, setActiveSegment] = useState<SegmentTabKey>(analytics.activeSegment)
  const [selectedCustomer, setSelectedCustomer] = useState<FriendsFamilyCustomerSegment | null>(
    null
  )
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSegmentPending, startSegmentTransition] = useTransition()
  const [isDetailPending, startDetailTransition] = useTransition()

  const activeTab = SEGMENT_TABS.find((tab) => tab.key === activeSegment) ?? SEGMENT_TABS[0]
  const visibleCustomers = useMemo(() => {
    return [...currentAnalytics.customers].sort((a, b) => {
      const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority)
      if (priorityDelta !== 0) return priorityDelta
      if (b.score !== a.score) return b.score - a.score
      return new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime()
    })
  }, [currentAnalytics.customers])

  const handleSegmentChange = (segment: SegmentTabKey) => {
    setActiveSegment(segment)
    setError(null)

    startSegmentTransition(async () => {
      const result = await getFriendsFamilyAnalytics({ segment, limit: CUSTOMER_LIMIT })
      if (result.success && result.data) {
        setCurrentAnalytics(result.data)
      } else {
        setError(result.error || 'Failed to load segment')
      }
    })
  }

  const handleOpenCustomer = (customerKey: string) => {
    setDetailLoadingKey(customerKey)
    setError(null)

    startDetailTransition(async () => {
      const result = await getFriendsFamilyCustomerDetail(customerKey)
      setDetailLoadingKey(null)

      if (result.success && result.data) {
        setSelectedCustomer(result.data)
      } else {
        setError(result.error || 'Failed to load customer detail')
      }
    })
  }

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-950">Friends &amp; Family Analytics</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              Customers are grouped by contact and ranked for clean repeat use. Approval in the last
              30 days is weighted highest; refunds are separated from the recommendation list.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-500 sm:items-end">
            <div>Generated {formatDateTime(currentAnalytics.generatedAt)}</div>
            <div className="text-xs">Scoped to the last year and latest 2,500 submissions.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryTile
          label="Best Targets"
          value={formatNumber(currentAnalytics.summary.bestTargets)}
          detail="Clean, full-price customers with strong reuse signal"
          icon={ShieldCheck}
        />
        <SummaryTile
          label="Approved Last 30 Days"
          value={formatNumber(currentAnalytics.summary.recentApprovals)}
          detail="Highest recency signal for the offer"
          icon={Clock3}
        />
        <SummaryTile
          label="Repeat Customers"
          value={formatNumber(currentAnalytics.summary.repeatCustomers)}
          detail="Two or more successful approved notes"
          icon={RotateCcw}
        />
        <SummaryTile
          label="Family Signal"
          value={formatNumber(currentAnalytics.summary.familySignal)}
          detail="Caregiver or multiple-patient contact patterns"
          icon={HeartHandshake}
        />
        <SummaryTile
          label="Refund History"
          value={formatNumber(currentAnalytics.summary.refunded)}
          detail="Separated from targeting for lower noise"
          icon={AlertTriangle}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card className="p-0">
          <CardHeader>
            <CardTitle>Customer Segments</CardTitle>
            <CardDescription>{activeTab.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Customer segments">
              {SEGMENT_TABS.map((tab) => {
                const selected = activeSegment === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => handleSegmentChange(tab.key)}
                    disabled={isSegmentPending}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      selected
                        ? 'border-gray-950 bg-gray-950 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-xs',
                        selected ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {getSegmentCount(currentAnalytics, tab.key)}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {formatNumber(visibleCustomers.length)} of{' '}
                {formatNumber(currentAnalytics.segmentTotal)} customers in this segment.
              </span>
              {isSegmentPending && <span>Loading segment...</span>}
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Last Approved
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Issues
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Why
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {visibleCustomers.map((customer) => (
                    <tr key={customer.customerKey} className="hover:bg-gray-50">
                      <td className="px-4 py-4 align-top">
                        <div className="max-w-52">
                          <div className="truncate font-medium text-gray-950">
                            {customer.displayName}
                          </div>
                          <a
                            href={`mailto:${customer.email}`}
                            className="mt-1 block truncate text-sm text-blue-700 hover:underline"
                          >
                            {customer.email}
                          </a>
                          {customer.phone && (
                            <div className="mt-1 text-xs text-gray-500">{customer.phone}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          <PriorityBadge priority={customer.priority} />
                          <span className="text-xs text-gray-500">Score {customer.score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm whitespace-nowrap text-gray-700">
                        {formatDate(customer.lastApprovedAt)}
                      </td>
                      <td className="px-4 py-4 align-top text-sm whitespace-nowrap text-gray-700">
                        <div className="font-medium text-gray-950">{customer.totalNotes} total</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {customer.approvedNotes} approved / {customer.approvedLastSixMonths} in
                          6mo
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-gray-700">
                        <div className="min-w-44">{issueText(customer)}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <CustomerReasons customer={customer} />
                      </td>
                      <td className="px-4 py-4 text-right align-top">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isDetailPending && detailLoadingKey === customer.customerKey}
                          onClick={() => handleOpenCustomer(customer.customerKey)}
                        >
                          {isDetailPending && detailLoadingKey === customer.customerKey
                            ? 'Loading...'
                            : 'Details'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visibleCustomers.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <CheckCircle2 className="mx-auto size-8 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700">
                  No customers in this segment.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="p-0">
            <CardHeader>
              <CardTitle>Ranking Rules</CardTitle>
              <CardDescription>Visible logic for high-confidence targeting.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-emerald-700" />
                <span>
                  Recent approvals, repeat use, no refunds, and full-price history rank up.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 text-amber-700" />
                <span>Denials and maybe history rank down but do not automatically exclude.</span>
              </div>
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 size-4 text-gray-700" />
                <span>Customers are grouped by email first, then phone if needed.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader>
              <CardTitle>Offer Snapshot</CardTitle>
              <CardDescription>Analytics only. No sending or campaign state.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Targetable full-price customers</span>
                <span className="font-semibold text-gray-950">
                  {formatNumber(currentAnalytics.summary.targetableFullPriceCustomers)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Friends20 users</span>
                <span className="font-semibold text-gray-950">
                  {formatNumber(currentAnalytics.summary.offerUsed)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Net customer revenue</span>
                <span className="font-semibold text-gray-950">
                  {formatCurrency(currentAnalytics.summary.netRevenueCents)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Gross collected</span>
                <span className="font-semibold text-gray-950">
                  {formatCurrency(currentAnalytics.summary.grossRevenueCents)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Refunded amount</span>
                <span className="font-semibold text-gray-950">
                  {formatCurrency(currentAnalytics.summary.refundedRevenueCents)}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>

      <CustomerDetailDialog customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  )
}
