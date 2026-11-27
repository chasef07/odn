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
  automationStillRunningSms,
  automationSuccessSms,
  changeNoteMenuSms,
  csrQueuedSms,
  dateChangeManualSms,
  diagnosisSymptomsConfirmSms,
  guardianRequiredSms,
  invalidDateSms,
  invalidPurposeSms,
  issueDateManualSms,
  nameCorrectionPromptSms,
  noteNotReceivedEmailSms,
  noteNotReceivedFoundSms,
  noteNotReceivedSms,
  offlineNoticeSms,
  otherMenuSms,
  refundManualSms,
  restrictionsConfirmSms,
  returnDateInfoSms,
  supportIntroMenuSms,
  thankYouReplySms,
} from '../sms-support-templates'

const GSM7_BASIC = /^[A-Za-z0-9 @$_!"#%&'()*+,\-./:;<=>?\n]*$/

describe('sms support templates', () => {
  it('sends the clinic-written offline notice as one GSM-7 segment', () => {
    const body = offlineNoticeSms()

    expect(body).toBe(
      'Hello. Our team is currently offline and will respond as soon as possible in the morning. We appreciate your patience.'
    )
    expect(body).toMatch(GSM7_BASIC)
    expect(body).toHaveLength(118)
  })

  it('uses numbered SMS menus instead of unsupported dropdown wording', () => {
    const body = supportIntroMenuSms()

    expect(body).toBe(
      [
        'How can we help? Reply with a number.',
        '1 I did not receive my note',
        '2 I need to change my note',
        '3 Other',
      ].join('\n')
    )
    expect(body).not.toContain('\n4 Diagnosis')
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

  it('uses the requested issue-date response', () => {
    const body = issueDateManualSms()

    expect(body).toBe(
      "Unfortunately, we cannot change the date as it is based on when your request was made and the doctor's review of your chart."
    )
  })

  it('confirms an automated note update with one clinic-written message', () => {
    expect(automationSuccessSms()).toBe(
      'Thank you. We are sending an updated note to your email address now.'
    )
  })

  it('uses the requested spam-check flow before collecting email for missing notes', () => {
    expect(noteNotReceivedSms()).toContain('Reply 1 if you found it')
    expect(noteNotReceivedSms()).toContain('2 if you still cannot find it')
    expect(noteNotReceivedEmailSms()).toContain('correct email address')
    expect(noteNotReceivedFoundSms()).toBe(
      'Thank you. Please let us know if we can assist with anything further.'
    )
  })

  it('leaves the ticket-level footer out of support prompt and reply templates', () => {
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
      guardianRequiredSms(),
      issueDateManualSms(),
      returnDateInfoSms(),
      diagnosisSymptomsConfirmSms(),
      nameCorrectionPromptSms(),
      restrictionsConfirmSms(),
      refundManualSms(),
      askRefundReasonSms(),
      askOtherMessageSms(),
      automationSuccessSms(),
      csrQueuedSms(),
      thankYouReplySms(),
      automationBlockedSms('admin review is required'),
      invalidDateSms(),
      invalidPurposeSms(),
      automationStillRunningSms(),
      adminSupportReplySms('We are checking this.'),
    ]

    for (const body of bodies) {
      expect(body).not.toContain('Reply HELP for note changes or customer support.')
      expect(body).not.toContain('STOP to opt out.')
    }
  })
})
