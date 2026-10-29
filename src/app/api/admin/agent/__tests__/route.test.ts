import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyticsView } from '@/db/analytics-query'

type StreamResult = Awaited<ReturnType<MockLanguageModelV4['doStream']>>
type StreamPart = StreamResult['stream'] extends ReadableStream<infer Part> ? Part : never

const {
  mockGetSession,
  mockRunAnalyticsQuery,
  mockIsAnalyticsConfigured,
  mockFindAgentThread,
  mockSaveAgentThread,
  model,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRunAnalyticsQuery: vi.fn(),
  mockIsAnalyticsConfigured: vi.fn(() => true),
  mockFindAgentThread: vi.fn(),
  mockSaveAgentThread: vi.fn(),
  model: { current: null as unknown },
}))

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

vi.mock('@/db/agent-threads', () => ({
  findAgentThread: mockFindAgentThread,
  saveAgentThread: mockSaveAgentThread,
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

const THREAD_ID = '0b9a4d8e-2f43-4c1e-9d55-7a1f3c2b6e10'

function userMessage(id: string, text: string) {
  return { id, role: 'user' as const, parts: [{ type: 'text' as const, text }] }
}

function ask(question: string, body?: unknown): Request {
  return new Request('http://localhost/api/admin/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? { id: THREAD_ID, message: userMessage('u1', question) }),
  })
}

function storedThread(adminUserId: string, messages: unknown[]) {
  return {
    id: THREAD_ID,
    adminUserId,
    title: 'Notes per month',
    messages,
    createdAt: new Date('2026-10-20T12:00:00.000Z'),
    updatedAt: new Date('2026-10-20T12:00:00.000Z'),
  }
}

async function chunks(response: Response): Promise<{ type: string; [key: string]: unknown }[]> {
  const text = await response.text()
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice('data: '.length)))
}

beforeEach(() => {
  mockGetSession.mockResolvedValue({
    user: { id: 'doc_1', email: 'doctor@example.test', emailVerified: true },
  })
  mockIsAnalyticsConfigured.mockReturnValue(true)
  mockFindAgentThread.mockResolvedValue(null)
  mockSaveAgentThread.mockResolvedValue(undefined)
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

  it('answers 400 when the body has no thread id or no user message, and reads no thread', async () => {
    const question = userMessage('u1', 'Notes per month')

    expect((await POST(ask('', { prompt: 'Notes per month' }))).status).toBe(400)
    expect((await POST(ask('', { id: 'not-a-uuid', message: question }))).status).toBe(400)
    expect(
      (await POST(ask('', { id: THREAD_ID, message: { ...question, role: 'assistant' } }))).status
    ).toBe(400)
    expect(mockFindAgentThread).not.toHaveBeenCalled()
  })

  it('answers 404 for a thread another admin owns and neither runs nor saves anything', async () => {
    mockFindAgentThread.mockResolvedValue(storedThread('doc_2', []))
    const mock = new MockLanguageModelV4({ doStream: [textStep('Never sent.')] })
    model.current = mock

    const response = await POST(ask('Notes per month'))

    expect(response.status).toBe(404)
    expect(mockFindAgentThread).toHaveBeenCalledWith(THREAD_ID)
    expect(mock.doStreamCalls).toHaveLength(0)
    expect(mockSaveAgentThread).not.toHaveBeenCalled()
  })

  it('saves a new thread titled by its question once the answer finishes', async () => {
    model.current = new MockLanguageModelV4({ doStream: [textStep('412 notes in August.')] })

    await chunks(await POST(ask('  Notes   sold in August?  ')))

    expect(mockSaveAgentThread).toHaveBeenCalledTimes(1)
    const saved = mockSaveAgentThread.mock.calls[0][0]
    expect(saved).toMatchObject({
      id: THREAD_ID,
      adminUserId: 'doc_1',
      title: 'Notes sold in August?',
    })
    expect(saved.messages).toEqual([
      userMessage('u1', '  Notes   sold in August?  '),
      expect.objectContaining({
        role: 'assistant',
        parts: expect.arrayContaining([
          expect.objectContaining({ type: 'text', text: '412 notes in August.' }),
        ]),
      }),
    ])
  })

  it('continues a stored thread: the model sees its history and the save keeps it', async () => {
    const earlier = [
      userMessage('u1', 'Notes sold in August?'),
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: '412 notes.' }] },
    ]
    mockFindAgentThread.mockResolvedValue(storedThread('doc_1', earlier))
    const mock = new MockLanguageModelV4({ doStream: [textStep('455 in September.')] })
    model.current = mock

    await chunks(
      await POST(ask('', { id: THREAD_ID, message: userMessage('u2', 'And September?') }))
    )

    const prompt = JSON.stringify(mock.doStreamCalls[0].prompt)
    expect(prompt).toContain('Notes sold in August?')
    expect(prompt).toContain('412 notes.')
    expect(prompt).toContain('And September?')
    const saved = mockSaveAgentThread.mock.calls[0][0]
    expect(saved.title).toBe('Notes sold in August?')
    expect(saved.messages.map((message: { id: string }) => message.id).slice(0, 3)).toEqual([
      'u1',
      'a1',
      'u2',
    ])
    expect(saved.messages).toHaveLength(4)
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
          series: [{ column: 'notes', label: 'Notes sold', format: 'number' }],
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
          series: [{ column: 'notes', label: 'Notes sold', format: 'number' }],
          rows,
          truncated: false,
        },
      })
    )
    expect(parts).toContainEqual(
      expect.objectContaining({ type: 'text-delta', delta: 'September beat August.' })
    )
    expect(console.info).toHaveBeenCalledWith('admin agent query', {
      adminEmail: 'doctor@example.test',
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
          series: [{ column: 'revenue', label: 'Revenue', format: 'dollars' }],
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
      adminEmail: 'doctor@example.test',
      sql: 'select nope from submissions',
      error: 'column "nope" does not exist',
    })
  })
})
