import { Linter, type ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import lifecycleOwner from '../lifecycle-owner.mjs'

const linter = new Linter()
const config: Linter.Config = {
  plugins: { local: lifecycleOwner as ESLint.Plugin },
  rules: { 'local/lifecycle-owner': 'error' },
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
}

function violations(code: string): number {
  return linter.verify(code, config).length
}

describe('local/lifecycle-owner', () => {
  it('flags any set() on the full submissions table', () => {
    const flagged = [
      'set(submissions, { status: next })',
      'set(submissions, patch)',
      'set(submissions, { followUpEmailClaimedAt: now })',
    ]
    for (const code of flagged) expect(violations(code), code).toBe(1)
  })

  it('flags an insert that sets a refund column', () => {
    const flagged = [
      'insert(submissions, { status, stripeRefundId: id })',
      "insert(submissions, { ...row, 'refundedAt': at })",
    ]
    for (const code of flagged) expect(violations(code), code).toBe(1)
  })

  it('flags raw SQL that writes status or a refund column, across interpolations', () => {
    const flagged = [
      'const q = sql`UPDATE submissions SET status = ${next} WHERE id = ${id}`',
      'const q = sql`UPDATE submissions SET updated_at = ${at}, stripe_refund_id = ${refund} WHERE id = ${id}`',
      'const q = sql`UPDATE "submissions" SET refunded_at = now() RETURNING id`',
      "const q = 'UPDATE submissions SET status = $1'",
      'const q = sql`INSERT INTO submissions (id, stripe_refund_id) VALUES (${id}, ${refund})`',
      "const q = 'INSERT INTO submissions(id, refunded_at) VALUES ($1, $2)'",
    ]
    for (const code of flagged) expect(violations(code), code).toBe(1)
  })

  it('allows detail writes, birth status, and status in reads or WHERE clauses', () => {
    const allowed = [
      'set(submissionDetails, { followUpEmailClaimedAt: now })',
      'insert(submissions, { status })',
      'insert(submissions, submission)',
      'set(smsSupportJobs, { status })',
      'const q = sql`UPDATE submissions SET ${set(submissionDetails, patch)} WHERE id = ${id} AND status = ${s}`',
      'const q = sql`UPDATE submissions SET denial_reason = NULL WHERE status = ${s} RETURNING status`',
      'const q = sql`SELECT status, refunded_at FROM submissions WHERE status = ${s}`',
      'const q = sql`UPDATE sms_support_jobs SET status = ${s} WHERE id = ${id}`',
      'const q = sql`INSERT INTO submissions (id, status) VALUES (${id}, ${s})`',
    ]
    for (const code of allowed) expect(violations(code), code).toBe(0)
  })
})
