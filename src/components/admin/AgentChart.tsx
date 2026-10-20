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
import type { ChartResult } from '@/lib/agent/tools'

const PALETTE_SIZE = 5

function color(index: number): string {
  return `var(--chart-${(index % PALETTE_SIZE) + 1})`
}

function cartesian(chart: ChartResult) {
  const axes = [
    <CartesianGrid key="grid" vertical={false} />,
    <XAxis key="x" dataKey={chart.x} tickLine={false} axisLine={false} tickMargin={8} />,
    <YAxis key="y" tickLine={false} axisLine={false} width={48} />,
    <ChartTooltip key="tooltip" content={<ChartTooltipContent />} />,
  ]
  if (chart.y.length > 1) {
    axes.push(<ChartLegend key="legend" content={<ChartLegendContent />} />)
  }
  return axes
}

function Plot({ chart }: { chart: ChartResult }) {
  const { kind, rows, x, y } = chart
  if (kind === 'pie') {
    return (
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey={x} />} />
        <Pie data={rows} dataKey={y[0]} nameKey={x} label>
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
        {y.map((key, index) => (
          <Line
            key={key}
            dataKey={key}
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
        {y.map((key, index) => (
          <Area
            key={key}
            dataKey={key}
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
      {y.map((key, index) => (
        <Bar key={key} dataKey={key} fill={color(index)} radius={4} />
      ))}
    </BarChart>
  )
}

export function AgentChart({ chart }: { chart: ChartResult }) {
  const config: ChartConfig = Object.fromEntries(
    chart.y.map((key, index) => [key, { label: key, color: color(index) }])
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
