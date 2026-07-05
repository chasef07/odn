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

    expect(body).toContain('\n1 Note not received')
    expect(body).toContain('\n2 Change note')
    expect(body).toContain('\n3 Other')
    expect(body).not.toContain('\n4 Diagnosis')
    expect(body).toContain('STOP to opt out')
    expect(body).not.toMatch(/dropdown|select from the menu/i)
  })

  it('keeps the expanded change-note paths behind the short intro menu', () => {
    const body = changeNoteMenuSms()

    expect(body).toContain('\n1 Issue/evaluation date')
    expect(body).toContain('\n2 First/last day off')
    expect(body).toContain('\n3 Birthday')
    expect(body).toContain('\n6 Work/school/travel purpose')
    expect(body).toContain('\n9 Other')
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
      otherMenuSms(),
      askSubmissionReferenceSms(),
      askDobSms(),
      askPurposeSms(),
      noteNotReceivedSms(),
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
