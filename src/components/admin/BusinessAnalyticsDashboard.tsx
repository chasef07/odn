'use client'

import { useMemo, useState, useTransition } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { getBusinessAnalytics } from '@/app/admin/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { BusinessAnalytics, BusinessAnalyticsRange } from '@/lib/business-analytics'

type RangeOption = {
  key: BusinessAnalyticsRange
  label: string
}

const RANGE_OPTIONS: RangeOption[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
]

const REVENUE_COLOR = '#16a34a'
const NOTES_COLOR = '#2563eb'

const revenueChartConfig = {
  netRevenue: { label: 'Net revenue', color: REVENUE_COLOR },
} satisfies ChartConfig

const notesChartConfig = {
  notes: { label: 'Notes', color: NOTES_COLOR },
} satisfies ChartConfig

const outcomeDotColors: Record<string, string> = {
  approved: '#16a34a',
  denied: '#dc2626',
  maybe: '#d97706',
  pending: '#2563eb',
  manual: '#7c3aed',
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatCurrency(cents: number, showCents = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(cents / 100)
}

function formatCompactDollars(value: number): string {
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}k`
  return `$${Math.round(value)}`
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

type DeltaConfig = {
  text: string
  positive: boolean
  neutral?: boolean
}

function pctDelta(value: number | null): DeltaConfig | null {
  if (value === null) return null
  if (value === 0) return { text: '0%', positive: true, neutral: true }
  const rounded = Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)
  return {
    text: `${value >= 0 ? '+' : '−'}${rounded}%`,
    positive: value >= 0,
  }
}

function pointsDelta(value: number | null): DeltaConfig | null {
  if (value === null) return null
  if (value === 0) return { text: '0pp', positive: true, neutral: true }
  const points = Math.abs(value * 100).toFixed(1)
  return {
    text: `${value >= 0 ? '+' : '−'}${points}pp`,
    positive: value >= 0,
  }
}

function DeltaBadge({ delta, invert = false }: { delta: DeltaConfig | null; invert?: boolean }) {
  if (!delta) return null
  if (delta.neutral) {
    return (
      <span className="inline-flex items-center text-xs font-medium text-gray-500 tabular-nums">
        {delta.text}
      </span>
    )
  }
  const isGood = invert ? !delta.positive : delta.positive
  const Icon = delta.positive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        isGood ? 'text-emerald-600' : 'text-red-600'
      )}
    >
      <Icon className="size-3" />
      {delta.text}
    </span>
  )
}

function KpiTile({
  label,
  value,
  delta,
  invertDelta = false,
}: {
  label: string
  value: string
  delta?: DeltaConfig | null
  invertDelta?: boolean
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="text-[10px] font-medium tracking-wider text-gray-500 uppercase">
          {label}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-2xl font-semibold text-gray-950 tabular-nums sm:text-3xl">
            {value}
          </div>
          <DeltaBadge delta={delta ?? null} invert={invertDelta} />
        </div>
      </CardContent>
    </Card>
  )
}

export function BusinessAnalyticsDashboard({ analytics }: { analytics: BusinessAnalytics }) {
  const [currentAnalytics, setCurrentAnalytics] = useState(analytics)
  const [activeRange, setActiveRange] = useState<BusinessAnalyticsRange>(analytics.summary.range)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const trendData = useMemo(
    () =>
      currentAnalytics.trend.map((point) => ({
        key: point.key,
        label: point.label,
        notes: point.notes,
        netRevenue: point.netRevenueCents / 100,
      })),
    [currentAnalytics.trend]
  )

  const topStates = useMemo(
    () =>
      [...currentAnalytics.stateRows]
        .sort((a, b) => b.netRevenueCents - a.netRevenueCents)
        .slice(0, 10),
    [currentAnalytics.stateRows]
  )

  const outcomeRows = useMemo(
    () => currentAnalytics.outcomeBreakdown.filter((row) => row.notes > 0),
    [currentAnalytics.outcomeBreakdown]
  )

  // Show roughly 6-8 X axis ticks regardless of point count
  const xAxisInterval = useMemo(() => {
    if (trendData.length <= 8) return 0
    return Math.max(0, Math.floor(trendData.length / 6) - 1)
  }, [trendData.length])

  const handleRangeChange = (range: BusinessAnalyticsRange) => {
    if (range === activeRange) return
    setError(null)
    startTransition(async () => {
      const result = await getBusinessAnalytics({ range })
      if (result.success && result.data) {
        setCurrentAnalytics(result.data)
        setActiveRange(result.data.summary.range)
      } else {
        setError(result.error || 'Failed to load analytics')
      }
    })
  }

  const summary = currentAnalytics.summary

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Analytics</h1>
          <p className="mt-1 text-xs text-gray-500 tabular-nums">
            {formatShortDate(summary.startDate)} – {formatShortDate(summary.endDate)}
            {summary.comparisonLabel ? (
              <span className="text-gray-400"> · vs {summary.comparisonLabel}</span>
            ) : null}
          </p>
        </div>
        <div
          className="inline-flex self-start rounded-lg border bg-white p-0.5 sm:self-auto"
          role="tablist"
          aria-label="Analytics range"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={activeRange === option.key}
              disabled={isPending}
              onClick={() => handleRangeChange(option.key)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                activeRange === option.key
                  ? 'bg-gray-950 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Net Revenue" value={formatCurrency(summary.netRevenueCents)} />
        <KpiTile label="Approved Notes" value={formatNumber(summary.approvedNotes)} />
        <KpiTile label="Repeat Customer Rate" value={formatPercent(summary.repeatCustomerRate)} />
        <KpiTile label="Refund Rate" value={formatPercent(summary.refundRate)} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="p-0">
          <CardHeader className="px-4 pt-3 pb-1">
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="text-xs font-medium tracking-wider text-gray-500 uppercase">
                Net Revenue / day
              </CardTitle>
              <span className="text-xs font-medium text-gray-950 tabular-nums">
                {formatCurrency(summary.netRevenueCents)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-0 pb-2">
            {trendData.length === 0 ? (
              <div className="flex h-36 items-center justify-center text-xs text-gray-400">
                No data
              </div>
            ) : (
              <ChartContainer config={revenueChartConfig} className="h-36 w-full">
                <AreaChart data={trendData} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={REVENUE_COLOR} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={REVENUE_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    minTickGap={24}
                    interval="preserveStartEnd"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tickCount={4}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={formatCompactDollars}
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Area
                    type="monotone"
                    dataKey="netRevenue"
                    name="Net revenue"
                    stroke={REVENUE_COLOR}
                    strokeWidth={1.75}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="px-4 pt-3 pb-1">
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="text-xs font-medium tracking-wider text-gray-500 uppercase">
                Notes / day
              </CardTitle>
              <span className="text-xs font-medium text-gray-950 tabular-nums">
                {formatNumber(summary.approvedNotes)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-0 pb-2">
            {trendData.length === 0 ? (
              <div className="flex h-36 items-center justify-center text-xs text-gray-400">
                No data
              </div>
            ) : (
              <ChartContainer config={notesChartConfig} className="h-36 w-full">
                <BarChart data={trendData} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    minTickGap={24}
                    interval="preserveStartEnd"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    tickCount={4}
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                  <Bar dataKey="notes" name="Notes" fill={NOTES_COLOR} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">
              Top States by Net Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topStates.length === 0 ? (
              <div className="py-6 text-xs text-gray-400">No data</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-medium tracking-wider text-gray-500 uppercase">
                    <th className="py-2 text-left font-medium">State</th>
                    <th className="py-2 text-right font-medium">Notes</th>
                    <th className="py-2 text-right font-medium">Net Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topStates.map((row) => (
                    <tr key={row.state} className="border-b last:border-0">
                      <td className="py-1.5 font-medium text-gray-900">{row.state}</td>
                      <td className="py-1.5 text-right text-gray-700 tabular-nums">
                        {formatNumber(row.notes)}
                      </td>
                      <td className="py-1.5 text-right font-medium text-gray-950 tabular-nums">
                        {formatCurrency(row.netRevenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Outcome Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {outcomeRows.length === 0 ? (
              <div className="py-6 text-xs text-gray-400">No data</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-medium tracking-wider text-gray-500 uppercase">
                    <th className="py-2 text-left font-medium">Outcome</th>
                    <th className="py-2 text-right font-medium">Notes</th>
                    <th className="py-2 text-right font-medium">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomeRows.map((row) => (
                    <tr key={row.key} className="border-b last:border-0">
                      <td className="py-1.5 font-medium text-gray-900">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{
                              backgroundColor: outcomeDotColors[row.key] ?? '#94a3b8',
                            }}
                          />
                          {row.label}
                        </span>
                      </td>
                      <td className="py-1.5 text-right text-gray-700 tabular-nums">
                        {formatNumber(row.notes)}
                      </td>
                      <td className="py-1.5 text-right font-medium text-gray-950 tabular-nums">
                        {formatPercent(row.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
