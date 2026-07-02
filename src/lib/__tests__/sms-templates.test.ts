import { describe, expect, it } from 'vitest'
import {
  approvalSentSms,
  denialSentSms,
  emailBounceSms,
  maybeUpdateSms,
  purchaseConfirmationSms,
  submissionReference,
} from '../sms-templates'

describe('sms templates', () => {
  it('uses a reference number, not Medical Record number, for purchase SMS', () => {
    const body = purchaseConfirmationSms('78a58d67-0000-0000-0000-000000000000')

    expect(submissionReference('78a58d67-0000-0000-0000-000000000000')).toBe('78A58D67')
    expect(body).toContain('Ref #78A58D67')
    expect(body).not.toMatch(/Medical Record/i)
    expect(body.length).toBeLessThanOrEqual(160)
  })

  it('keeps bounce SMS support-email based', () => {
    const body = emailBounceSms()

    expect(body).toContain('hello@onlinedoctornote.com')
    expect(body).toMatch(/reply HELP/i)
    expect(body).not.toMatch(/reply to this text/i)
    expect(body.length).toBeLessThanOrEqual(320)
  })

  it('includes HELP and opt-out copy in transactional SMS copy', () => {
    const bodies = [
      purchaseConfirmationSms('78a58d67-0000-0000-0000-000000000000'),
      emailBounceSms(),
      maybeUpdateSms(),
      approvalSentSms(),
      denialSentSms(),
    ]

    for (const body of bodies) {
      expect(body).toMatch(/\bHELP\b/)
      expect(body).toContain('note changes or customer support')
      expect(body).toContain('STOP to opt out')
      expect(body.length).toBeLessThanOrEqual(320)
    }
  })
})
