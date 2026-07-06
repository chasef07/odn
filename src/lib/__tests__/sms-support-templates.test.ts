import { describe, expect, it } from 'vitest'
import {
  additionalFormManualSms,
  adminSupportReplySms,
  askDobSms,
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
  dateChangeManualSms,
  diagnosisSymptomsConfirmSms,
  invalidDateSms,
  invalidPurposeSms,
  issueDateManualSms,
  nameCorrectionPromptSms,
  noteNotReceivedEmailSms,
  noteNotReceivedFoundSms,
  noteNotReceivedSms,
  otherMenuSms,
  refundManualSms,
  restrictionsConfirmSms,
  returnDateInfoSms,
  supportIntroMenuSms,
} from '../sms-support-templates'
import { SMS_SUPPORT_CATEGORY } from '../sms-support-types'

describe('sms support templates', () => {
  it('uses numbered SMS menus instead of unsupported dropdown wording', () => {
    const body = supportIntroMenuSms()

    expect(body).toContain('How can we help? Reply with a number.')
    expect(body).toContain('\n1 I did not receive my note')
    expect(body).toContain('\n2 I need to change my note')
    expect(body).toContain('\n3 Other')
    expect(body).not.toContain('\n4 Diagnosis')
    expect(body).toContain('STOP to opt out')
    expect(body).not.toMatch(/dropdown|select from the menu/i)
  })

  it('keeps the expanded change-note paths behind the short intro menu', () => {
    const body = changeNoteMenuSms()

    expect(body).toContain('\n1 Issue/evaluation date')
    expect(body).toContain('\n2 First/last day off')
    expect(body).toContain('\n3 Date of birth')
    expect(body).toContain('\n6 Change purpose to work/school/travel')
    expect(body).toContain('\n8 Need restrictions/accommodations')
    expect(body).toContain('\n9 Other')
  })

  it('collects DOB and purpose changes with constrained prompts', () => {
    expect(askDobSms()).toContain('MM/DD/YYYY')
    expect(askPurposeSms()).toContain('\n1 Work')
    expect(askPurposeSms()).toContain('Legal notes need admin review')
  })

  it('keeps the issue-date response in one SMS segment with the required footer', () => {
    const body = issueDateManualSms()

    expect(body).toContain("We can't change the date")
    expect(body.length).toBeLessThanOrEqual(160)
  })

  it('sets the right expectation for queued automation', () => {
    expect(automationQueuedSms()).toContain('updating your approved note')
    expect(automationQueuedSms()).toContain('new email')
  })

  it('uses the requested spam-check flow before collecting email for missing notes', () => {
    expect(noteNotReceivedSms()).toContain('Reply 1 if you found it')
    expect(noteNotReceivedSms()).toContain('2 if you still cannot find it')
    expect(noteNotReceivedEmailSms()).toContain('correct email address')
    expect(noteNotReceivedFoundSms()).toContain('No further action')
  })

  it('keeps HELP and opt-out copy in every support prompt and reply template', () => {
    const bodies = [
      supportIntroMenuSms(),
      changeNoteMenuSms(),
      otherMenuSms(),
      askSubmissionReferenceSms(),
      askDobSms(),
      askPurposeSms(),
      noteNotReceivedSms(),
      noteNotReceivedEmailSms(),
      noteNotReceivedFoundSms(),
      additionalFormManualSms(),
      dateChangeManualSms(),
      issueDateManualSms(),
      returnDateInfoSms(),
      diagnosisSymptomsConfirmSms(),
      nameCorrectionPromptSms(),
      restrictionsConfirmSms(),
      refundManualSms(),
      askRefundReasonSms(),
      askOtherMessageSms(),
      automationQueuedSms(),
      automationSuccessSms(SMS_SUPPORT_CATEGORY.CHANGE_DOB),
      csrQueuedSms(),
      automationBlockedSms('admin review is required'),
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
