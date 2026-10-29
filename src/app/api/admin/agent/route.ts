import { convertToModelMessages, safeValidateUIMessages, stepCountIs, streamText } from 'ai'
import { z } from 'zod'
import { findAgentThread, saveAgentThread } from '@/db/agent-threads'
import { describeAnalyticsSchema } from '@/db/analytics-query'
import { findAdminSession } from '@/lib/admin-session'
import { agentModel, isAgentConfigured } from '@/lib/agent/model'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { storedMessages, threadTitle } from '@/lib/agent/threads'
import { agentTools, type AgentUIMessage } from '@/lib/agent/tools'
import { todayET } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const MAX_STEPS = 8

const requestSchema = z.object({
  id: z.uuid(),
  message: z.looseObject({ role: z.literal('user') }),
})

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

  const body = requestSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return Response.json({ error: z.prettifyError(body.error) }, { status: 400 })
  }
  const { id } = body.data

  const thread = await findAgentThread(id)
  if (thread && thread.adminUserId !== admin.doctorId) {
    return Response.json({ error: 'This thread belongs to another admin.' }, { status: 404 })
  }

  const tools = agentTools({ adminEmail: admin.email })
  const question = await safeValidateUIMessages<AgentUIMessage>({
    messages: [body.data.message],
    tools,
  })
  if (!question.success) {
    return Response.json({ error: question.error.message }, { status: 400 })
  }
  const messages = [...(await storedMessages(thread, tools)), ...question.data]

  const result = streamText({
    model: agentModel(),
    system: buildSystemPrompt(await describeAnalyticsSchema(), todayET()),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
  })
  void result.consumeStream()
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: errorText,
    onEnd: ({ messages: answered }) =>
      saveAgentThread({
        id,
        adminUserId: admin.doctorId,
        title: threadTitle(answered),
        messages: answered,
      }),
  })
}
