import { convertToModelMessages, safeValidateUIMessages, stepCountIs, streamText } from 'ai'
import { describeAnalyticsSchema } from '@/db/analytics-query'
import { findAdminSession } from '@/lib/admin-session'
import { agentModel, isAgentConfigured } from '@/lib/agent/model'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { agentTools, type AgentUIMessage } from '@/lib/agent/tools'
import { todayET } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const MAX_STEPS = 8

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function POST(request: Request): Promise<Response> {
  const admin = await findAdminSession(request.headers)
  if (!admin) return Response.json({ error: 'Sign in as an admin first.' }, { status: 401 })
  if (!isAgentConfigured()) {
    return Response.json(
      { error: 'The data agent needs TELNYX_INFERENCE_API_KEY and ANALYTICS_DATABASE_URL.' },
      { status: 503 }
    )
  }

  const tools = agentTools({ adminEmail: admin.email })
  const body: { messages?: unknown } | null = await request.json().catch(() => null)
  const messages = await safeValidateUIMessages<AgentUIMessage>({
    messages: body?.messages,
    tools,
  })
  if (!messages.success) {
    return Response.json({ error: messages.error.message }, { status: 400 })
  }

  const result = streamText({
    model: agentModel(),
    system: buildSystemPrompt(await describeAnalyticsSchema(), todayET()),
    messages: await convertToModelMessages(messages.data),
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
  })
  return result.toUIMessageStreamResponse({ onError: errorText })
}
