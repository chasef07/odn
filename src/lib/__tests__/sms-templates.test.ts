import { describe, expect, it } from 'vitest'
import {
  approvalSentSms,
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

  it('keeps bounce SMS manual and support-email based', () => {
    const body = emailBounceSms()

    expect(body).toContain('hello@onlinedoctornote.com')
    expect(body).not.toMatch(/reply HELP/i)
    expect(body).not.toMatch(/reply to this text/i)
    expect(body.length).toBeLessThanOrEqual(160)
  })

  it('does not include HELP in transactional SMS copy', () => {
    const bodies = [
      purchaseConfirmationSms('78a58d67-0000-0000-0000-000000000000'),
      emailBounceSms(),
      maybeUpdateSms(),
      approvalSentSms(),
    ]

    for (const body of bodies) {
      expect(body).not.toMatch(/\bHELP\b/)
      expect(body).toContain('STOP to opt out')
      expect(body.length).toBeLessThanOrEqual(160)
    }
  })
})
