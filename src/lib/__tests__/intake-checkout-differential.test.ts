import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FormData } from '@/lib/form-storage'
import { checkoutBlockers, parseIntake } from '@/lib/intake'
import { validatePaidSubmissionData } from './fixtures/checkout-validator-147a48e'
import { cases, now } from './fixtures/intake-cases'

const BASE_VALIDATOR_BLOB = 'd767ed5bee6f1b7bab0c5434d412799f1d022940'

function baseRejection(draft: unknown): string | null {
  return validatePaidSubmissionData(draft as FormData).errors[0] ?? null
}

function headBlocksInShadowMode(draft: unknown): boolean {
  const result = parseIntake(draft)
  if (result.kind === 'shape_failure') return true
  return result.kind === 'rule_failure' && checkoutBlockers(result.issues, false).length > 0
}

beforeAll(() => {
  vi.useFakeTimers({ now, toFake: ['Date'] })
})
afterAll(() => {
  vi.useRealTimers()
})

describe('checkout in shadow mode rejects everything the validator at main 147a48e rejected', () => {
  it('fixture is byte-identical to blob d767ed5 at 147a48e', () => {
    const source = readFileSync('src/lib/__tests__/fixtures/checkout-validator-147a48e.ts')
    const blob = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex')
    expect(blob, 'compare with: git rev-parse 147a48e:src/lib/paid-submission-validation.ts').toBe(
      BASE_VALIDATOR_BLOB
    )
  })

  it('at least 40 fixtures the base rejected', () => {
    const rejected = cases.filter(([, draft]) => baseRejection(draft) !== null)
    expect(rejected.length).toBeGreaterThanOrEqual(40)
  })

  it.each(cases)('%s', (_label, draft) => {
    const rejection = baseRejection(draft)
    if (rejection === null) return
    expect(headBlocksInShadowMode(draft), `main rejected it: ${rejection}`).toBe(true)
  })
})

describe('checkout in shadow mode lets through everything the validator at main 147a48e let through', () => {
  it('at least 80 fixtures the base accepted', () => {
    const accepted = cases.filter(([, draft]) => baseRejection(draft) === null)
    expect(accepted.length).toBeGreaterThanOrEqual(80)
  })

  it.each(cases)('%s', (_label, draft) => {
    if (baseRejection(draft) !== null) return
    const result = parseIntake(draft)
    if (result.kind === 'shape_failure') return
    const blockers = result.kind === 'rule_failure' ? checkoutBlockers(result.issues, false) : []
    expect(blockers.map((issue) => `${issue.field}:${issue.rule}`)).toEqual([])
  })
})
