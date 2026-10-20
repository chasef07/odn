import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyticsView } from '@/db/analytics-query'

type StreamResult = Awaited<ReturnType<MockLanguageModelV4['doStream']>>
type StreamPart = StreamResult['stream'] extends ReadableStream<infer Part> ? Part : never

const { mockGetSession, mockRunAnalyticsQuery, mockIsAnalyticsConfigured, model } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockRunAnalyticsQuery: vi.fn(),
    mockIsAnalyticsConfigured: vi.fn(() => true),
    model: { current: null as unknown },
  })
)

const VIEWS: AnalyticsView[] = [
  {
    name: 'submissions',
    description: 'One row per paid order.',
    columns: [
      { name: 'created_day_et', type: 'date', description: 'Business day in New York.' },
      { name: 'payment_amount_cents', type: 'integer', description: 'Amount in cents.' },
    ],
  },
]

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }))

vi.mock('@/db/analytics-query', () => ({
  runAnalyticsQuery: mockRunAnalyticsQuery,
  describeAnalyticsSchema: vi.fn(async () => VIEWS),
  isAnalyticsConfigured: mockIsAnalyticsConfigured,
}))

vi.mock('@/lib/agent/model', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/agent/model')>()),
  agentModel: () => model.current,
}))

import { POST } from '../route'

const MONTHLY_SQL =
  "select to_char(created_day_et, 'YYYY-MM') as month, count(*) as notes from submissions group by 1 order by 1"

const FINISH = {
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  },
  providerMetadata: undefined,
}

function toolCallStep(toolName: string, input: object): StreamResult {
  return {
    stream: convertArrayToReadableStream<StreamPart>([
      { type: 'stream-start', warnings: [] },
      { type: 'tool-call', toolCallId: 'call_1', toolName, input: JSON.stringify(input) },
      { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, ...FINISH },
    ]),
  }
}

function textStep(text: string): StreamResult {
  return {
    stream: convertArrayToReadableStream<StreamPart>([
      { type: 'stream-start', warnings: [] },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: text },
      { type: 'text-end', id: 't1' },
      { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, ...FINISH },
    ]),
  }
}

function ask(question: string, body?: unknown): Request {
  return new Request('http://localhost/api/admin/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      body ?? { messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: question }] }] }
    ),
  })
}

async function chunks(response: Response): Promise<{ type: string; [key: string]: unknown }[]> {
  const text = await response.text()
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice('data: '.length)))
}

beforeEach(() => {
  mockGetSession.mockResolvedValue({ user: { id: 'doc_1', email: 'doc@example.com' } })
  mockIsAnalyticsConfigured.mockReturnValue(true)
  vi.stubEnv('TELNYX_INFERENCE_API_KEY', 'test-inference-key')
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('POST /api/admin/agent', () => {
  it('answers 401 without an admin session and runs nothing', async () => {
    mockGetSession.mockResolvedValue(null)

    const response = await POST(ask('Notes per month'))

    expect(response.status).toBe(401)
    expect(mockRunAnalyticsQuery).not.toHaveBeenCalled()
  })

  it('answers 503 when the inference key or the analytics database is not configured', async () => {
    vi.stubEnv('TELNYX_INFERENCE_API_KEY', '')
    expect((await POST(ask('Notes per month'))).status).toBe(503)

    vi.stubEnv('TELNYX_INFERENCE_API_KEY', 'test-inference-key')
    mockIsAnalyticsConfigured.mockReturnValue(false)
    expect((await POST(ask('Notes per month'))).status).toBe(503)
  })

  it('answers 400 when the body has no messages', async () => {
    const response = await POST(ask('', { prompt: 'Notes per month' }))

    expect(response.status).toBe(400)
  })

  it('runs the chart SQL in Postgres and streams the chart built from its rows', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T02:00:00.000Z'))
    const rows = [
      { month: '2026-08', notes: 412 },
      { month: '2026-09', notes: 455 },
    ]
    mockRunAnalyticsQuery.mockResolvedValue({ columns: ['month', 'notes'], rows, truncated: false })
    const mock = new MockLanguageModelV4({
      doStream: [
        toolCallStep('chart', {
          sql: MONTHLY_SQL,
          kind: 'line',
          title: 'Notes per month',
          x: 'month',
          y: ['notes'],
        }),
        textStep('September beat August.'),
      ],
    })
    model.current = mock

    const parts = await chunks(await POST(ask('Notes per month')))

    expect(mockRunAnalyticsQuery).toHaveBeenCalledWith(MONTHLY_SQL)
    expect(parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-output-available',
        toolCallId: 'call_1',
        output: {
          kind: 'line',
          title: 'Notes per month',
          x: 'month',
          y: ['notes'],
          rows,
          truncated: false,
        },
      })
    )
    expect(parts).toContainEqual(
      expect.objectContaining({ type: 'text-delta', delta: 'September beat August.' })
    )
    expect(console.info).toHaveBeenCalledWith('admin agent query', {
      adminEmail: 'doc@example.com',
      sql: MONTHLY_SQL,
      rowCount: 2,
    })
    const system = mock.doStreamCalls[0].prompt[0]
    expect(system.role).toBe('system')
    expect(system.content).toContain('Today is 2026-10-20 in America/New_York')
    expect(system.content).toContain('- payment_amount_cents (integer): Amount in cents.')
    expect(JSON.stringify(mock.doStreamCalls[1].prompt)).toContain('"notes":455')
  })

  it('streams a tool error naming the columns when the chart asks for one the SQL does not return', async () => {
    mockRunAnalyticsQuery.mockResolvedValue({
      columns: ['month', 'notes'],
      rows: [{ month: '2026-09', notes: 455 }],
      truncated: false,
    })
    const mock = new MockLanguageModelV4({
      doStream: [
        toolCallStep('chart', {
          sql: MONTHLY_SQL,
          kind: 'bar',
          title: 'Revenue',
          x: 'month',
          y: ['revenue'],
        }),
        textStep('That column is missing.'),
      ],
    })
    model.current = mock

    const parts = await chunks(await POST(ask('Revenue per month')))

    expect(parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-output-error',
        errorText: 'The SQL does not return revenue. It returns: month, notes.',
      })
    )
    expect(JSON.stringify(mock.doStreamCalls[1].prompt)).toContain('does not return revenue')
  })

  it('streams the Postgres error of a failed query back to the model and the admin', async () => {
    mockRunAnalyticsQuery.mockRejectedValue(new Error('column "nope" does not exist'))
    const mock = new MockLanguageModelV4({
      doStream: [
        toolCallStep('query', { sql: 'select nope from submissions' }),
        textStep('Fixing it.'),
      ],
    })
    model.current = mock

    const parts = await chunks(await POST(ask('Anything')))

    expect(parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-output-error',
        errorText: 'column "nope" does not exist',
      })
    )
    expect(console.info).toHaveBeenCalledWith('admin agent query', {
      adminEmail: 'doc@example.com',
      sql: 'select nope from submissions',
      error: 'column "nope" does not exist',
    })
  })
})
