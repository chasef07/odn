import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { isAnalyticsConfigured } from '@/db/analytics-query'
import { env } from '@/lib/env'

export const AGENT_MODEL_ID = 'zai-org/GLM-5.3'

const TELNYX_INFERENCE_URL = 'https://api.telnyx.com/v2/ai/openai'

export function isAgentConfigured(): boolean {
  return env.TELNYX_INFERENCE_API_KEY !== undefined && isAnalyticsConfigured()
}

export function agentModel(): LanguageModel {
  const apiKey = env.TELNYX_INFERENCE_API_KEY
  if (!apiKey) throw new Error('TELNYX_INFERENCE_API_KEY is not set')
  const telnyx = createOpenAICompatible({ name: 'telnyx', baseURL: TELNYX_INFERENCE_URL, apiKey })
  return telnyx(AGENT_MODEL_ID)
}
