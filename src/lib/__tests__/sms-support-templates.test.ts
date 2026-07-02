import { describe, expect, it } from 'vitest'
import {
  adminSupportReplySms,
  askDobSms,
  askFirstDayOffSms,
  askLastDayOffSms,
  askOtherMessageSms,
  askPurposeSms,
  askRefundReasonSms,
  askSubmissionReferenceSms,
  automationBlockedSms,
  automationQueuedSms,
  automationStillRunningSms,
  automationSuccessSms,
  changeNoteMenuSms,
  csrQueuedSms,
  invalidDateSms,
  invalidPurposeSms,
  noteNotReceivedSms,
  supportIntroMenuSms,
} from '../sms-support-templates'
import { SMS_SUPPORT_CATEGORY } from '../sms-support-types'

describe('sms support templates', () => {
  it('uses numbered SMS menus instead of unsupported dropdown wording', () => {
    const body = supportIntroMenuSms()

    expect(body).toContain('\n1 Note not received')
    expect(body).toContain('\n2 Change note')
    expect(body).toContain('STOP to opt out')
    expect(body).not.toMatch(/dropdown|select from the menu/i)
  })

  it('collects DOB and purpose changes with constrained prompts', () => {
    expect(askDobSms()).toContain('MM/DD/YYYY')
    expect(askPurposeSms()).toContain('\n1 Work')
    expect(askPurposeSms()).toContain('Legal notes need staff review')
  })

  it('sets the right expectation for queued automation', () => {
    expect(automationQueuedSms()).toContain('updating your approved note')
    expect(automationQueuedSms()).toContain('new email')
  })

  it('keeps HELP and opt-out copy in every support prompt and reply template', () => {
    const bodies = [
      supportIntroMenuSms(),
      changeNoteMenuSms(),
      askSubmissionReferenceSms(),
      askDobSms(),
      askFirstDayOffSms(),
      askLastDayOffSms(),
      askPurposeSms(),
      noteNotReceivedSms(),
      askRefundReasonSms(),
      askOtherMessageSms(),
      automationQueuedSms(),
      automationSuccessSms(SMS_SUPPORT_CATEGORY.CHANGE_DOB),
      csrQueuedSms(),
      automationBlockedSms('staff review is required'),
      invalidDateSms(),
      invalidPurposeSms(),
      automationStillRunningSms(),
      adminSupportReplySms('We are checking this.'),
    ]

    for (const body of bodies) {
      expect(body).toMatch(/\bHELP\b/)
      expect(body).toContain('note changes or customer support')
      expect(body).toContain('STOP to opt out.')
    }
  })
})
