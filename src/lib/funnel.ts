import { z } from 'zod'
import { INTAKE_STEPS } from '@/lib/intake'
import { locales, type Locale } from '@/lib/i18n'

export const FUNNEL_STEPS = [
  'visit',
  '/start',
  ...INTAKE_STEPS.map((step) => step.route),
  '/payment',
  '/payment/success',
] as const

export type FunnelStep = (typeof FUNNEL_STEPS)[number]

export type FunnelStepView = {
  visitorId: string
  step: FunnelStep
  stepOrder: number
  locale: Locale
}

const funnelStepViewSchema = z
  .object({
    visitorId: z.uuid(),
    step: z.enum(FUNNEL_STEPS),
    locale: z.enum(locales),
  })
  .strict()

export function parseFunnelStepView(body: unknown): FunnelStepView | null {
  const result = funnelStepViewSchema.safeParse(body)
  if (!result.success) return null
  return { ...result.data, stepOrder: FUNNEL_STEPS.indexOf(result.data.step) + 1 }
}
