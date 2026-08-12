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
    expect(body).toBe(
      [
        'OnlineDoctorNote: Request received. Ref #78A58D67. Watch email/spam.',
        'Reply HELP for support.',
        'STOP to opt out.',
      ].join('\n')
    )
    expect(body).not.toMatch(/Medical Record/i)
    expect(body.length).toBeLessThanOrEqual(160)
  })

  it('ends the approval SMS with the short HELP line before STOP', () => {
    expect(approvalSentSms()).toBe(
      [
        "OnlineDoctorNote: Your doctor's note was sent to your email. Check inbox/spam.",
        'Reply HELP for support.',
        'STOP to opt out.',
      ].join('\n')
    )
  })

  it('keeps bounce SMS support-email based', () => {
    const body = emailBounceSms()

    expect(body).toContain('hello@onlinedoctornote.com')
    expect(body).toMatch(/reply HELP/i)
    expect(body).not.toMatch(/reply to this text/i)
    expect(body.length).toBeLessThanOrEqual(320)
  })

  it('keeps the existing long HELP line on other transactional SMS copy', () => {
    const bodies = [emailBounceSms(), maybeUpdateSms(), denialSentSms()]

    for (const body of bodies) {
      expect(body).toContain('Reply HELP for note changes or customer support.')
      expect(body).toContain('\nSTOP to opt out.')
      expect(body.length).toBeLessThanOrEqual(320)
    }
  })
})
