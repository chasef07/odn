import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { parseIntake } from '@/lib/intake'
import { cases, now } from './fixtures/intake-cases'

beforeAll(() => {
  vi.useFakeTimers({ now, toFake: ['Date'] })
})
afterAll(() => {
  vi.useRealTimers()
})

describe('intake verdict per fixture: valid persists as PENDING_REVIEW, rule_failure persists as MAYBE and is a 400 only when INTAKE_VALIDATION_ENFORCED, shape_failure is a 400 before payment and a retryable 500 at the webhook', () => {
  it.each(cases)('%s', (_label, draft, expected) => {
    expect(parseIntake(draft).kind).toBe(expected)
  })
})
