'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  DollarSign,
  MapPin,
  ReceiptText,
  RotateCcw,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { getBusinessAnalytics } from '@/app/admin/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type {
  BusinessAnalytics,
  BusinessAnalyticsRange,
  BusinessAnalyticsTone,
} from '@/lib/business-analytics'

type RangeOption = {
  key: BusinessAnalyticsRange
  label: string
}

const RANGE_OPTIONS: RangeOption[] = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '365d', label: '1 year' },
]

const trendChartConfig = {
  notes: {
    label: 'Notes',
    color: '#2563eb',
  },
  netRevenue: {
    label: 'Net revenue',
    color: '#16a34a',
  },
} satisfies ChartConfig

const outcomeChartConfig = {
  notes: {
    label: 'Notes',
    color: '#2563eb',
  },
} satisfies ChartConfig

const stateChartConfig = {
  netRevenue: {
    label: 'Net revenue',
    color: '#16a34a',
  },
} satisfies ChartConfig

const ageChartConfig = {
  notes: {
    label: 'Notes',
    color: '#7c3aed',
  },
} satisfies ChartConfig

const toneClasses: Record<BusinessAnalyticsTone, string> = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  negative: 'border-red-200 bg-red-50 text-red-800',
  neutral: 'border-gray-200 bg-gray-50 text-gray-700',
}

const outcomeColors = ['#16a34a', '#dc2626', '#d97706', '#2563eb', '#7c3aed']

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
  if (Math.abs(value) >= 1000) {
    return `$${Math.round(value / 1000)}k`
  }

  return `$${Math.round(value)}`
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatDelta(value: number | null): string {
  if (value === null) return 'new'
  const rounded = Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)
  return `${value >= 0 ? '+' : '-'}${rounded}%`
}

function formatPointDelta(value: number | null): string {
  if (value === null) return 'new'
  const points = Math.abs(value * 100).toFixed(1)
  return `${value >= 0 ? '+' : '-'}${points} pts`
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

function KpiCard({
  label,
  value,
  detail,
  delta,
  deltaTone,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  delta?: string
  deltaTone?: BusinessAnalyticsTone
  icon: LucideIcon
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex min-h-36 flex-col justify-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
            <Icon className="size-5" />
          </div>
          {delta && (
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs font-medium',
                toneClasses[deltaTone ?? 'neutral']
              )}
            >
              {delta}
            </span>
          )}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-950">{value}</div>
          <div className="mt-1 text-sm font-medium text-gray-900">{label}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">{detail}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-white px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {detail && <div className="mt-0.5 text-xs text-gray-500">{detail}</div>}
      </div>
      <div className="shrink-0 text-right font-mono text-sm font-semibold text-gray-950">
        {value}
      </div>
    </div>
  )
}

function ProgressMetric({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-gray-500">{label}</span>
        <span className="font-mono font-semibold text-gray-900">{formatNumber(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-gray-900" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border bg-gray-50 text-sm text-gray-500">
      {label}
    </div>
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
        ...point,
        netRevenue: point.netRevenueCents / 100,
      })),
    [currentAnalytics.trend]
  )
  const stateData = useMemo(
    () =>
      currentAnalytics.stateRows.map((row) => ({
        ...row,
        netRevenue: row.netRevenueCents / 100,
      })),
    [currentAnalytics.stateRows]
  )
  const ageData = useMemo(
    () =>
      currentAnalytics.ageBands.map((row) => ({
        ...row,
        netRevenue: row.netRevenueCents / 100,
      })),
    [currentAnalytics.ageBands]
  )
  const maxOutcomeNotes = Math.max(...currentAnalytics.outcomeBreakdown.map((row) => row.notes), 0)

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
  const netRevenueTone =
    summary.netRevenueDeltaPct === null || summary.netRevenueDeltaPct >= 0 ? 'positive' : 'warning'
  const notesTone =
    summary.notesDeltaPct === null || summary.notesDeltaPct >= 0 ? 'positive' : 'warning'
  const refundTone =
    summary.refundRateDeltaPoints === null || summary.refundRateDeltaPoints <= 0
      ? 'positive'
      : 'warning'
  const repeatTone =
    summary.repeatCustomerRateDeltaPoints === null || summary.repeatCustomerRateDeltaPoints >= 0
      ? 'positive'
      : 'neutral'

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-950">Business Analytics</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              Revenue-first view for note volume, net revenue, refunds, repeat customers, and
              all-time demographic signal.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div
              className="flex rounded-lg border bg-white p-1"
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
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    activeRange === option.key
                      ? 'bg-gray-950 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-500">
              Generated {formatDateTime(currentAnalytics.generatedAt)}
            </div>
          </div>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Net Revenue"
          value={formatCurrency(summary.netRevenueCents)}
          detail={`${formatCurrency(summary.grossRevenueCents)} gross, ${formatCurrency(
            summary.refundedRevenueCents
          )} refunded`}
          delta={formatDelta(summary.netRevenueDeltaPct)}
          deltaTone={netRevenueTone}
          icon={DollarSign}
        />
        <KpiCard
          label="Notes"
          value={formatNumber(summary.totalNotes)}
          detail={`${formatNumber(summary.paidNotes)} paid notes in ${summary.rangeLabel.toLowerCase()}`}
          delta={formatDelta(summary.notesDeltaPct)}
          deltaTone={notesTone}
          icon={ReceiptText}
        />
        <KpiCard
          label="Average Net / Paid Note"
          value={formatCurrency(summary.averageNetRevenuePerPaidNoteCents, true)}
          detail="Net revenue divided by paid notes"
          icon={TrendingUp}
        />
        <KpiCard
          label="Refund Rate"
          value={formatPercent(summary.refundRate)}
          detail={`${formatNumber(summary.refundedNotes)} refunded notes`}
          delta={formatPointDelta(summary.refundRateDeltaPoints)}
          deltaTone={refundTone}
          icon={AlertTriangle}
        />
        <KpiCard
          label="Repeat Customers"
          value={formatNumber(summary.repeatCustomers)}
          detail={`${formatPercent(summary.repeatCustomerRate)} of customers`}
          delta={formatPointDelta(summary.repeatCustomerRateDeltaPoints)}
          deltaTone={repeatTone}
          icon={RotateCcw}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card className="p-0">
          <CardHeader>
            <CardTitle>What changed</CardTitle>
            <CardDescription>
              {summary.rangeLabel} compared against the prior period.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {currentAnalytics.insights.map((insight) => (
              <div
                key={`${insight.title}-${insight.detail}`}
                className={cn('rounded-lg border p-3', toneClasses[insight.tone])}
              >
                <div className="text-sm font-semibold">{insight.title}</div>
                <div className="mt-1 text-xs leading-5">{insight.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader>
            <CardTitle>Revenue Quality</CardTitle>
            <CardDescription>Net revenue is gross less refunded orders.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <MetricRow label="Gross collected" value={formatCurrency(summary.grossRevenueCents)} />
            <MetricRow
              label="Refunded amount"
              value={formatCurrency(summary.refundedRevenueCents)}
              detail={`${formatPercent(summary.refundRate)} of notes`}
            />
            <MetricRow label="Net revenue" value={formatCurrency(summary.netRevenueCents)} />
            <MetricRow
              label="Offer usage"
              value={formatNumber(summary.offerNotes)}
              detail={`${formatCurrency(summary.offerNetRevenueCents)} net`}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="p-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5 text-gray-500" />
              <CardTitle>Notes and Net Revenue Over Time</CardTitle>
            </div>
            <CardDescription>{summary.rangeLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <EmptyChartState label="No notes in this range" />
            ) : (
              <ChartContainer config={trendChartConfig} className="h-80 w-full">
                <ComposedChart data={trendData} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={18}
                  />
                  <YAxis
                    yAxisId="notes"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    allowDecimals={false}
                    width={32}
                  />
                  <YAxis
                    yAxisId="revenue"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={52}
                    tickFormatter={formatCompactDollars}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    yAxisId="notes"
                    dataKey="notes"
                    name="Notes"
                    fill="var(--color-notes)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="netRevenue"
                    name="Net revenue"
                    stroke="var(--color-netRevenue)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-gray-500" />
              <CardTitle>Review Outcomes</CardTitle>
            </div>
            <CardDescription>{formatPercent(summary.approvalRate)} approved</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.totalNotes === 0 ? (
              <EmptyChartState label="No outcomes in this range" />
            ) : (
              <div className="flex flex-col gap-5">
                <ChartContainer config={outcomeChartConfig} className="h-64 w-full">
                  <BarChart data={currentAnalytics.outcomeBreakdown} margin={{ left: 4, right: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="notes" name="Notes" radius={[4, 4, 0, 0]}>
                      {currentAnalytics.outcomeBreakdown.map((row, index) => (
                        <Cell key={row.key} fill={outcomeColors[index % outcomeColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <div className="grid gap-3">
                  {currentAnalytics.outcomeBreakdown.map((row) => (
                    <ProgressMetric
                      key={row.key}
                      label={`${row.label} (${formatPercent(row.rate)})`}
                      value={row.notes}
                      max={maxOutcomeNotes}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="size-5 text-gray-500" />
              <CardTitle>Top States by Net Revenue</CardTitle>
            </div>
            <CardDescription>All submissions, sorted by net revenue.</CardDescription>
          </CardHeader>
          <CardContent>
            {stateData.length === 0 ? (
              <EmptyChartState label="No state data yet" />
            ) : (
              <ChartContainer config={stateChartConfig} className="h-80 w-full">
                <BarChart
                  data={stateData}
                  layout="vertical"
                  margin={{ left: 16, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCompactDollars}
                  />
                  <YAxis
                    dataKey="state"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={92}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="netRevenue"
                    name="Net revenue"
                    fill="var(--color-netRevenue)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-5 text-gray-500" />
              <CardTitle>Age Bands</CardTitle>
            </div>
            <CardDescription>All submissions by patient age.</CardDescription>
          </CardHeader>
          <CardContent>
            {ageData.length === 0 ? (
              <EmptyChartState label="No age data yet" />
            ) : (
              <ChartContainer config={ageChartConfig} className="h-80 w-full">
                <BarChart data={ageData} margin={{ left: 4, right: 4, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="notes"
                    name="Notes"
                    fill="var(--color-notes)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="p-0">
          <CardHeader>
            <CardTitle>Customer Base</CardTitle>
            <CardDescription>Repeat behavior and dense-use customer signal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetricRow
              label="New customers"
              value={formatNumber(summary.newCustomers)}
              detail={summary.rangeLabel}
            />
            <MetricRow
              label="Repeat customer revenue"
              value={formatCurrency(summary.repeatRevenueCents)}
              detail={`${formatPercent(summary.repeatCustomerRate)} repeat customer rate`}
            />
            <MetricRow
              label="3+ notes in 6 months"
              value={formatNumber(summary.threePlusNotesSixMonthsCustomers)}
              detail="High-use customer base"
            />
            <MetricRow
              label="Open reviews"
              value={formatNumber(summary.openNotes)}
              detail="Pending, maybe, or manual"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
