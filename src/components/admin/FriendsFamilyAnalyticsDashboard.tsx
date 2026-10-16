'use client'

import { useMemo, useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import {
  exportFriendsFamilyCustomers,
  getFriendsFamilyAnalytics,
} from '@/app/admin/_actions/analytics'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency, formatNumber, formatShortDate } from '@/lib/analytics-format'
import { cn } from '@/lib/utils'
import type {
  FriendsFamilyAnalytics,
  FriendsFamilyCustomerRow,
  FriendsFamilySegmentFilter,
} from '@/lib/friends-family-analytics'

const CUSTOMER_LIMIT = 50
const LOOKBACK_DAYS = 365

type SegmentTabKey = Extract<
  FriendsFamilySegmentFilter,
  'best_targets' | 'repeat_customers' | 'no_refunds' | 'all_customers'
>

type SegmentTab = {
  key: SegmentTabKey
  label: string
  description?: string
}

const SEGMENT_TABS: SegmentTab[] = [
  {
    key: 'best_targets',
    label: 'Best Targets',
    description:
      'Repeat customers, last order 30–90 days ago, never used promo — your highest-intent campaign pool.',
  },
  { key: 'repeat_customers', label: 'Repeat Customers' },
  {
    key: 'no_refunds',
    label: 'No Refunds',
    description: 'Customers who have never requested a refund.',
  },
  { key: 'all_customers', label: 'All Customers' },
]

function csvEscape(value: string): string {
  if (value === '') return ''
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildCsv(rows: FriendsFamilyCustomerRow[], includeScore = true): string {
  const header = [
    'displayName',
    'email',
    'phone',
    ...(includeScore ? ['score'] : []),
    'approvedNotes',
    'lastApprovedAt',
  ]
  const lines = [header.join(',')]

  for (const row of rows) {
    const lastApproved = row.lastApprovedAt ? row.lastApprovedAt.slice(0, 10) : ''
    lines.push(
      [
        csvEscape(row.displayName),
        csvEscape(row.email),
        csvEscape(row.phone),
        ...(includeScore ? [String(row.score)] : []),
        String(row.approvedNotes),
        lastApproved,
      ].join(',')
    )
  }

  return lines.join('\n')
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function KpiTile({
  label,
  value,
  sublabel,
  subvalue,
}: {
  label: string
  value: string
  sublabel?: string
  subvalue?: string
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="text-[10px] font-medium tracking-wider text-gray-500 uppercase">
          {label}
        </div>
        <div className="text-2xl font-semibold text-gray-950 tabular-nums sm:text-3xl">{value}</div>
        {sublabel && subvalue !== undefined && (
          <div className="flex items-baseline justify-between border-t border-gray-100 pt-2 text-xs">
            <span className="text-gray-500">{sublabel}</span>
            <span className="font-medium text-gray-950 tabular-nums">{subvalue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getSegmentCount(analytics: FriendsFamilyAnalytics, key: SegmentTabKey): number {
  switch (key) {
    case 'all_customers':
      return analytics.summary.totalCustomers
    case 'best_targets':
      return analytics.summary.bestTargets
    case 'repeat_customers':
      return analytics.summary.repeatCustomers
    case 'no_refunds':
      return analytics.summary.noRefunds
  }
}

export function FriendsFamilyAnalyticsDashboard({
  analytics,
}: {
  analytics: FriendsFamilyAnalytics
}) {
  const [currentAnalytics, setCurrentAnalytics] = useState(analytics)
  const initialSegment: SegmentTabKey = (SEGMENT_TABS.find(
    (tab) => tab.key === analytics.activeSegment
  )?.key ?? 'best_targets') as SegmentTabKey
  const [activeSegment, setActiveSegment] = useState<SegmentTabKey>(initialSegment)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)

  const allCustomers = currentAnalytics.customers
  const customers = allCustomers.slice(0, CUSTOMER_LIMIT)
  const summary = currentAnalytics.summary
  const activeSegmentTotal = getSegmentCount(currentAnalytics, activeSegment)

  const activeSegmentDescription =
    SEGMENT_TABS.find((tab) => tab.key === activeSegment)?.description ?? null

  const showScore = activeSegment !== 'no_refunds'

  const handleSegmentChange = (segment: SegmentTabKey) => {
    if (segment === activeSegment) return
    setError(null)
    setActiveSegment(segment)
    startTransition(async () => {
      const result = await getFriendsFamilyAnalytics({ segment, limit: CUSTOMER_LIMIT })
      if (result.success && result.data) {
        setCurrentAnalytics(result.data)
      } else {
        setError(result.error || 'Failed to load segment')
      }
    })
  }

  const handleExport = async () => {
    setError(null)
    setIsExporting(true)
    try {
      const result = await exportFriendsFamilyCustomers({ segment: activeSegment })
      if (result.success && result.data) {
        const today = new Date().toISOString().slice(0, 10)
        const filename = `customer-segment-${activeSegment}-${today}.csv`
        downloadCsv(filename, buildCsv(result.data, showScore))
      } else {
        const message = result.error || 'Failed to export customer list'
        console.error('Failed to export friends-family customers:', message)
        setError(message)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export customer list'
      console.error('Failed to export friends-family customers:', err)
      setError(message)
    } finally {
      setIsExporting(false)
    }
  }

  const eligiblePool = summary.totalCustomers
  const offerNetRevenue = useMemo(
    () => formatCurrency(summary.offerNetRevenueCents),
    [summary.offerNetRevenueCents]
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Customer Segments</h1>
          <p className="mt-1 text-xs text-gray-500 tabular-nums">
            Eligible customer pool: {formatNumber(eligiblePool)} · lookback {LOOKBACK_DAYS} days
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="No Refunds" value={formatNumber(summary.noRefunds)} />
        <KpiTile label="Repeat Customers" value={formatNumber(summary.repeatCustomers)} />
        <KpiTile label="Best Targets" value={formatNumber(summary.bestTargets)} />
        <KpiTile
          label="10% Promo Orders (doctor10)"
          value={formatNumber(summary.offerNotesCount)}
          sublabel="Net revenue"
          subvalue={offerNetRevenue}
        />
      </div>

      <Card className="p-0">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Customer segments">
              {SEGMENT_TABS.map((tab) => {
                const selected = activeSegment === tab.key
                const count = getSegmentCount(currentAnalytics, tab.key)
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    disabled={isPending}
                    onClick={() => handleSegmentChange(tab.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      selected
                        ? 'border-gray-950 bg-gray-950 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn('tabular-nums', selected ? 'text-white/70' : 'text-gray-400')}
                    >
                      ({formatNumber(count)})
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 tabular-nums">
                {isPending
                  ? 'Loading…'
                  : activeSegmentTotal > customers.length
                    ? `Preview of ${formatNumber(customers.length)} — CSV exports up to 50,000 customers`
                    : `${formatNumber(customers.length)} customers`}
              </span>
              <button
                type="button"
                onClick={handleExport}
                disabled={activeSegmentTotal === 0 || isPending || isExporting}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-3.5" />
                {isExporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>
          {activeSegmentDescription && (
            <p className="mt-2 text-xs text-gray-500">{activeSegmentDescription}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {customers.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-400">
              No customers in this segment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-medium tracking-wider text-gray-500 uppercase">
                    <th className="py-2 pr-3 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    {showScore && <th className="px-3 py-2 text-right font-medium">Score</th>}
                    <th className="px-3 py-2 text-right font-medium">Notes</th>
                    <th className="py-2 pl-3 text-right font-medium">Last Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((row) => (
                    <tr key={row.customerKey} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium text-gray-900">{row.displayName}</td>
                      <td className="px-3 py-2 text-gray-700">
                        <a href={`mailto:${row.email}`} className="text-blue-700 hover:underline">
                          {row.email}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-gray-700 tabular-nums">{row.phone}</td>
                      {showScore && (
                        <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                          {row.score}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                        {formatNumber(row.approvedNotes)}
                      </td>
                      <td className="py-2 pl-3 text-right text-gray-700 tabular-nums">
                        {formatShortDate(row.lastApprovedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
