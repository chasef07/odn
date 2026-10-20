'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { CustomerTotals, NotesSplit, SplitPeriod } from '@/db/analytics-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatSeriesValue } from '@/lib/agent/chart-format'

const chartConfig = {
  newNotes: { label: 'Brand new', color: 'var(--chart-1)' },
  returningNotes: { label: 'Returning', color: 'var(--chart-2)' },
} satisfies ChartConfig

const PERIODS: Record<SplitPeriod, { button: string; latest: string }> = {
  day: { button: 'Day', latest: 'Today' },
  month: { button: 'Month', latest: 'This month' },
}

function count(value: number): string {
  return formatSeriesValue('number', value, 'exact')
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '0%' : formatSeriesValue('percent', (100 * part) / whole, 'axis')
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
      </CardContent>
    </Card>
  )
}

export function RepeatCustomerPanel({
  totals,
  splits,
}: {
  totals: CustomerTotals
  splits: Record<SplitPeriod, NotesSplit[]>
}) {
  const [period, setPeriod] = useState<SplitPeriod>('month')
  const rows = splits[period]
  const latest = rows.at(-1)
  const latestTotal = latest ? latest.newNotes + latest.returningNotes : 0

  return (
    <section aria-label="Repeat customers" className="mb-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Total notes, all time" value={count(totals.totalNotes)} />
        <Tile label="Unique customers, all time" value={count(totals.uniqueCustomers)} />
        <Tile
          label="Repeat customers"
          value={percent(totals.repeatCustomers, totals.uniqueCustomers)}
          detail={`${count(totals.repeatCustomers)} of ${count(totals.uniqueCustomers)} came back`}
        />
      </div>

      <Card className="py-4">
        <CardContent className="space-y-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Brand new vs returning notes</h2>
              {latest && (
                <p className="text-muted-foreground text-xs">
                  {PERIODS[period].latest}: {count(latestTotal)} notes, {count(latest.newNotes)}{' '}
                  brand new, {count(latest.returningNotes)} returning (
                  {percent(latest.returningNotes, latestTotal)})
                </p>
              )}
            </div>
            <div className="flex gap-1" role="group" aria-label="Period">
              {(Object.keys(PERIODS) as SplitPeriod[]).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={key === period ? 'default' : 'outline'}
                  aria-pressed={key === period}
                  onClick={() => setPeriod(key)}
                >
                  {PERIODS[key].button}
                </Button>
              ))}
            </div>
          </div>
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <BarChart data={rows}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="newNotes" stackId="notes" fill="var(--color-newNotes)" />
              <Bar
                dataKey="returningNotes"
                stackId="notes"
                fill="var(--color-returningNotes)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  )
}
