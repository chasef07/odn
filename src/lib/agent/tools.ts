import { tool, type InferUITools, type UIMessage } from 'ai'
import { z } from 'zod'
import { runAnalyticsQuery, type AnalyticsResult, type AnalyticsRow } from '@/db/analytics-query'

const sqlInput = z
  .string()
  .min(1)
  .describe('One Postgres select statement over the analytics views, without a trailing semicolon')

export const chartSpecSchema = z.object({
  sql: sqlInput,
  kind: z
    .enum(['bar', 'line', 'area', 'pie'])
    .describe(
      'line or area for trends over time, bar for comparing groups, pie for shares of one total'
    ),
  title: z.string().min(1).describe('Short chart title'),
  x: z.string().min(1).describe('Result column for the x axis, or the slice labels of a pie'),
  y: z
    .array(z.string().min(1))
    .min(1)
    .describe('Numeric result columns to plot, one series each. A pie takes exactly one.'),
})

export type ChartSpec = z.infer<typeof chartSpecSchema>

export type ChartResult = Omit<ChartSpec, 'sql'> & { rows: AnalyticsRow[]; truncated: boolean }

async function loggedQuery(adminEmail: string, sql: string): Promise<AnalyticsResult> {
  try {
    const result = await runAnalyticsQuery(sql)
    console.info('admin agent query', { adminEmail, sql, rowCount: result.rows.length })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.info('admin agent query', { adminEmail, sql, error: message })
    throw error
  }
}

function missingColumns(spec: ChartSpec, columns: string[]): string[] {
  return [spec.x, ...spec.y].filter((name) => !columns.includes(name))
}

export function agentTools({ adminEmail }: { adminEmail: string }) {
  return {
    query: tool({
      description:
        'Run one read-only select over the analytics views and return its columns and up to 500 rows.',
      inputSchema: z.object({ sql: sqlInput }),
      execute: ({ sql }) => loggedQuery(adminEmail, sql),
    }),
    chart: tool({
      description:
        'Run one read-only select over the analytics views and show its rows as a chart. The chart plots exactly what the SQL returns.',
      inputSchema: chartSpecSchema,
      execute: async (spec): Promise<ChartResult> => {
        if (spec.kind === 'pie' && spec.y.length !== 1) {
          throw new Error(`A pie chart takes exactly one y column, not ${spec.y.length}.`)
        }
        const result = await loggedQuery(adminEmail, spec.sql)
        const missing = missingColumns(spec, result.columns)
        if (missing.length > 0) {
          throw new Error(
            `The SQL does not return ${missing.join(', ')}. It returns: ${result.columns.join(', ')}.`
          )
        }
        const { kind, title, x, y } = spec
        return { kind, title, x, y, rows: result.rows, truncated: result.truncated }
      },
    }),
  }
}

export type AgentTools = InferUITools<ReturnType<typeof agentTools>>

export type AgentUIMessage = UIMessage<never, never, AgentTools>
