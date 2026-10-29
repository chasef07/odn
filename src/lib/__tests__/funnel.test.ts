import { describe, expect, it } from 'vitest'
import { FUNNEL_STEPS, parseFunnelStepView } from '@/lib/funnel'
import { INTAKE_STEPS } from '@/lib/intake'

const visitorId = '6f1c2a8e-4b7d-4c3a-9e2f-1a2b3c4d5e6f'

describe('FUNNEL_STEPS', () => {
  it('is every intake step in order, then payment, then the paid success page', () => {
    expect(FUNNEL_STEPS).toEqual([
      ...INTAKE_STEPS.map((step) => step.route),
      '/payment',
      '/payment/success',
    ])
  })
})

describe('parseFunnelStepView', () => {
  it('accepts a known step with its order', () => {
    expect(parseFunnelStepView({ visitorId, step: '/symptoms', locale: 'es' })).toEqual({
      visitorId,
      step: '/symptoms',
      stepOrder: FUNNEL_STEPS.indexOf('/symptoms') + 1,
      locale: 'es',
    })
  })

  it('numbers the first step 1 and the paid page last', () => {
    expect(parseFunnelStepView({ visitorId, step: '/get-started', locale: 'en' })?.stepOrder).toBe(
      1
    )
    expect(
      parseFunnelStepView({ visitorId, step: '/payment/success', locale: 'en' })?.stepOrder
    ).toBe(FUNNEL_STEPS.length)
  })

  it.each([
    ['an unknown step', { visitorId, step: '/admin', locale: 'en' }],
    ['a localized path', { visitorId, step: '/es/symptoms', locale: 'es' }],
    ['a visitor id that is not a uuid', { visitorId: 'abc', step: '/review', locale: 'en' }],
    ['an unknown locale', { visitorId, step: '/review', locale: 'fr' }],
    ['a missing field', { visitorId, step: '/review' }],
    ['an extra field', { visitorId, step: '/review', locale: 'en', email: 'a@b.co' }],
    ['a non-object', 'step'],
  ])('rejects %s', (_, body) => {
    expect(parseFunnelStepView(body)).toBeNull()
  })
})
