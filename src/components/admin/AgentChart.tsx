'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatSeriesValue } from '@/lib/agent/chart-format'
import type { ChartResult } from '@/lib/agent/tools'

const PALETTE_SIZE = 5

function color(index: number): string {
  return `var(--chart-${(index % PALETTE_SIZE) + 1})`
}

function tooltipValue(chart: ChartResult) {
  return (value: number, dataKey: string) => {
    const series = chart.series.find((entry) => entry.column === dataKey) ?? chart.series[0]
    return formatSeriesValue(series.format, value, 'exact')
  }
}

function cartesian(chart: ChartResult) {
  const axisFormat = chart.series[0].format
  const axes = [
    <CartesianGrid key="grid" vertical={false} />,
    <XAxis key="x" dataKey={chart.x} tickLine={false} axisLine={false} tickMargin={8} />,
    <YAxis
      key="y"
      tickLine={false}
      axisLine={false}
      width={56}
      tickFormatter={(value: number) => formatSeriesValue(axisFormat, value, 'axis')}
    />,
    <ChartTooltip
      key="tooltip"
      content={<ChartTooltipContent formatValue={tooltipValue(chart)} />}
    />,
  ]
  if (chart.series.length > 1) {
    axes.push(<ChartLegend key="legend" content={<ChartLegendContent />} />)
  }
  return axes
}

function Plot({ chart }: { chart: ChartResult }) {
  const { kind, rows, x, series } = chart
  if (kind === 'pie') {
    const [slice] = series
    return (
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey={x} formatValue={tooltipValue(chart)} />}
        />
        <Pie
          data={rows}
          dataKey={slice.column}
          nameKey={x}
          label={({ value }: { value: number }) => formatSeriesValue(slice.format, value, 'exact')}
        >
          {rows.map((row, index) => (
            <Cell key={String(row[x])} fill={color(index)} />
          ))}
        </Pie>
      </PieChart>
    )
  }
  if (kind === 'line') {
    return (
      <LineChart data={rows}>
        {cartesian(chart)}
        {series.map((entry, index) => (
          <Line
            key={entry.column}
            dataKey={entry.column}
            type="monotone"
            stroke={color(index)}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    )
  }
  if (kind === 'area') {
    return (
      <AreaChart data={rows}>
        {cartesian(chart)}
        {series.map((entry, index) => (
          <Area
            key={entry.column}
            dataKey={entry.column}
            type="monotone"
            stroke={color(index)}
            fill={color(index)}
            fillOpacity={0.3}
          />
        ))}
      </AreaChart>
    )
  }
  return (
    <BarChart data={rows}>
      {cartesian(chart)}
      {series.map((entry, index) => (
        <Bar key={entry.column} dataKey={entry.column} fill={color(index)} radius={4} />
      ))}
    </BarChart>
  )
}

export function AgentChart({ chart }: { chart: ChartResult }) {
  const config: ChartConfig = Object.fromEntries(
    chart.series.map((entry, index) => [entry.column, { label: entry.label, color: color(index) }])
  )
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">{chart.title}</figcaption>
      <ChartContainer config={config} className="aspect-auto h-72 w-full">
        <Plot chart={chart} />
      </ChartContainer>
      {chart.truncated && (
        <p className="text-muted-foreground text-xs">
          The query returned more than 500 rows, so the chart shows the first 500.
        </p>
      )}
    </figure>
  )
}
