import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { parseDateOnly, type DateOnly } from '@/lib/dates'

const TODAY = parseDateOnly('2026-10-20') as DateOnly

describe('buildSystemPrompt', () => {
  it('carries the date, every view and every column with its type and description', () => {
    const prompt = buildSystemPrompt(
      [
        {
          name: 'sms_messages',
          description: 'One row per text message.',
          columns: [{ name: 'direction', type: 'text', description: 'outbound or inbound.' }],
        },
        {
          name: 'submissions',
          description: 'One row per paid order.',
          columns: [
            { name: 'payment_amount_cents', type: 'integer', description: 'Amount in cents.' },
            { name: 'state', type: 'text', description: null },
          ],
        },
      ],
      TODAY,
      null
    )

    expect(prompt).toContain('Today is 2026-10-20 in America/New_York.')
    expect(prompt).toContain(
      '### sms_messages\nOne row per text message.\n- direction (text): outbound or inbound.'
    )
    expect(prompt).toContain(
      '### submissions\nOne row per paid order.\n- payment_amount_cents (integer): Amount in cents.\n- state (text)'
    )
    expect(prompt).not.toContain('Google Ads')
  })

  it('teaches Google Ads queries for the configured account only when Google Ads is on', () => {
    const prompt = buildSystemPrompt([], TODAY, {
      customerId: '7678754198',
      quotaProject: 'acuity-ads-api',
    })

    expect(prompt).toContain('## Google Ads')
    expect(prompt).toContain('account 7678754198')
    expect(prompt).toContain('divide micros by 1,000,000')
    expect(prompt).toContain('segments.date during LAST_30_DAYS')
    expect(prompt).not.toContain('acuity-ads-api')
  })
})
