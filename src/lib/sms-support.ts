import { SubmissionStatus, type SmsSupportTicket } from '@/db/types'
import {
  createInboundSupportTicket,
  escalateSupportTicketToCsr,
  failQueuedOrRunningSupportJobs,
  findActiveSupportTicketForPhone,
  linkSmsMessageToSupportTicket,
  markSupportTicketReplyFailed,
  recordSupportTicketInbound,
  updateSupportTicketConversation,
  type SupportTicketConversationUpdate,
} from '@/db/sms-support'
import {
  findApprovedSubmissionBirthDateForSupport,
  findApprovedSubmissionIdForSupportTicket,
  findApprovedSupportSubmissionIdsByReference,
  findLatestApprovedSubmissionIdsForSupportPhone,
  findSmsSupportSubmissionCandidatesForPhone,
} from '@/db/submissions'
import { isAtLeastAge, isIsoDateOnlyInSaneRange } from '@/lib/date-only'
import { formatDateUTC } from '@/lib/utils'
import { toE164UsPhone } from '@/lib/phone-utils'
import { normalizeMedicalRecordNumber } from '@/lib/note-verification'
import { normalizeSmsKeyword } from '@/lib/telnyx'
import {
  additionalFormManualSms,
  askDobSms,
  askOtherMessageSms,
  askPurposeSms,
  askSubmissionReferenceSms,
  automationBlockedSms,
  automationQueuedSms,
  automationStillRunningSms,
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
} from '@/lib/sms-support-templates'
import { sendSupportSms } from '@/lib/sms-support-sms'
import { alertSupportTicketNeedsCsr } from '@/lib/sms-support-alerts'
import { automationPayloadForCollectedData, automationSummary } from '@/lib/sms-support-automation'
import {
  enqueueSupportAutomationJob,
  processSmsSupportJobNow,
  SupportAutomationPayloadConflictError,
} from '@/lib/sms-support-jobs'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
  type SmsSupportCategory,
  type SmsSupportCollectedData,
  type SmsSupportState,
} from '@/lib/sms-support-types'

type SupportReplySmsType = 'SUPPORT_REPLY' | 'SUPPORT_AUTOMATION_UPDATE' | 'SUPPORT_CSR_ALERT'

export async function handleInboundSupportSms({
  fromPhone,
  body,
  providerMessageId,
  receivedAt = new Date(),
}: {
  fromPhone: string
  body: string
  providerMessageId?: string
  receivedAt?: Date
}): Promise<void> {
  const phoneE164 = toE164UsPhone(fromPhone) || fromPhone
  const trimmedBody = body.trim()
  if (!phoneE164 || !trimmedBody) return

  let ticket = await findActiveSupportTicketForPhone(phoneE164)
  if (!ticket) {
    const matchedSubmission = await findSafeSubmissionForPhone(phoneE164)
    ticket = await createInboundSupportTicket({
      phoneE164,
      submissionId: matchedSubmission?.id,
      lastInboundAt: receivedAt,
    })
  } else {
    const matchedSubmission =
      ticket.submissionId || ticket.status === SMS_SUPPORT_STATUS.RUNNING_AUTOMATION
        ? null
        : await findSafeSubmissionForPhone(phoneE164)
    ticket = await recordSupportTicketInbound(ticket.id, {
      matchedSubmissionId: matchedSubmission?.id,
      lastInboundAt: receivedAt,
    })
  }

  if (providerMessageId) {
    await linkSmsMessageToSupportTicket(providerMessageId, {
      supportTicketId: ticket.id,
      submissionId: ticket.submissionId ?? null,
    })
  }

  if (ticket.status === SMS_SUPPORT_STATUS.RUNNING_AUTOMATION) {
    await reply(ticket, automationStillRunningSms(), 'SUPPORT_AUTOMATION_UPDATE')
    return
  }

  if (isHelpRequest(trimmedBody)) {
    if (ticket.status === SMS_SUPPORT_STATUS.NEEDS_CSR) {
      await reply(ticket, csrQueuedSms(), 'SUPPORT_CSR_ALERT')
      return
    }

    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.INTRO_MENU,
        category: null,
        failureReason: null,
        collectedData: {},
      },
      supportIntroMenuSms()
    )
    return
  }

  await routeByState(ticket, trimmedBody, providerMessageId)
}

async function routeByState(
  ticket: SmsSupportTicket,
  body: string,
  providerMessageId?: string
): Promise<void> {
  switch (ticket.state) {
    case SMS_SUPPORT_STATE.INTRO_MENU:
      await routeIntroMenu(ticket, body)
      return
    case SMS_SUPPORT_STATE.CHANGE_NOTE_MENU:
      await routeChangeNoteMenu(ticket, body)
      return
    case SMS_SUPPORT_STATE.OTHER_MENU:
      await routeOtherMenu(ticket, body)
      return
    case SMS_SUPPORT_STATE.COLLECT_SUBMISSION_REF:
      await handleSubmissionReference(ticket, body, providerMessageId)
      return
    case SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_SPAM_CHECK:
      await collectMissingNoteSpamCheck(ticket, body)
      return
    case SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_COLLECT_EMAIL:
      await collectMissingNoteEmail(ticket, body)
      return
    case SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT:
      await collectDob(ticket, body)
      return
    case SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_FIRST:
    case SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_LAST:
      await moveToCsr(ticket, {
        category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
        summary: 'Customer asked to change first/last day off by SMS.',
        replyBody: dateChangeManualSms(),
      })
      return
    case SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT:
      await collectPurpose(ticket, body)
      return
    case SMS_SUPPORT_STATE.DIAGNOSIS_SYMPTOMS_CONFIRM:
      await collectDiagnosisSymptomsConfirmation(ticket, body)
      return
    case SMS_SUPPORT_STATE.NAME_CORRECTION_COLLECT:
      await collectNameCorrection(ticket, body)
      return
    case SMS_SUPPORT_STATE.RESTRICTIONS_CONFIRM:
      await collectRestrictionsConfirmation(ticket, body)
      return
    case SMS_SUPPORT_STATE.REFUND_COLLECT_REASON:
      await collectRefundReason(ticket, body)
      return
    case SMS_SUPPORT_STATE.OTHER_COLLECT_MESSAGE:
    case SMS_SUPPORT_STATE.CSR_REVIEW:
      await collectOtherMessage(ticket, body)
      return
    default:
      await updateTicketAndReply(
        ticket.id,
        {
          status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
          state: SMS_SUPPORT_STATE.INTRO_MENU,
        },
        supportIntroMenuSms()
      )
  }
}

async function routeIntroMenu(ticket: SmsSupportTicket, body: string): Promise<void> {
  if (isChangeNoteMenuRequest(body)) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
        category: null,
      },
      changeNoteMenuSms()
    )
    return
  }

  const category = categoryFromMessage(body)

  if (category === SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_SPAM_CHECK,
        category,
      },
      noteNotReceivedSms()
    )
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.CHANGE_DOB) {
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_DOB)
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.CHANGE_DATES) {
    await moveToCsr(ticket, {
      category,
      summary: 'Customer asked to change first/last day off by SMS.',
      replyBody: dateChangeManualSms(),
    })
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE) {
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE)
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.ISSUE_DATE) {
    await moveToCsr(ticket, {
      category,
      summary: 'Customer asked to change the issue/evaluation date by SMS.',
      replyBody: issueDateManualSms(),
    })
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.REFUND) {
    await moveToCsr(ticket, {
      category,
      summary: 'Customer asked about a refund by SMS.',
      replyBody: refundManualSms(),
    })
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.DIAGNOSIS_SYMPTOMS) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.DIAGNOSIS_SYMPTOMS_CONFIRM,
        category,
      },
      diagnosisSymptomsConfirmSms()
    )
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.RETURN_DATE) {
    await moveToCsr(ticket, {
      category,
      summary: 'Customer asked a return-date question by SMS.',
      replyBody: returnDateInfoSms(),
    })
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.ADDITIONAL_FORM) {
    await moveToCsr(ticket, {
      category,
      summary: 'Customer asked for an additional form by SMS.',
      replyBody: additionalFormManualSms(),
    })
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.NAME_CORRECTION) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.NAME_CORRECTION_COLLECT,
        category,
      },
      nameCorrectionPromptSms()
    )
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.RESTRICTIONS_ACCOMMODATIONS) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.RESTRICTIONS_CONFIRM,
        category,
      },
      restrictionsConfirmSms()
    )
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.OTHER) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.OTHER_MENU,
        category,
      },
      otherMenuSms()
    )
    return
  }

  await updateTicketAndReply(
    ticket.id,
    {
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
    },
    supportIntroMenuSms()
  )
}

async function routeChangeNoteMenu(ticket: SmsSupportTicket, body: string): Promise<void> {
  const normalized = normalizeSmsKeyword(body)

  if (normalized === '1' || normalized.includes('ISSUE') || normalized.includes('EVALUATION')) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.ISSUE_DATE,
      summary: 'Customer asked to change the issue/evaluation date by SMS.',
      replyBody: issueDateManualSms(),
    })
    return
  }

  if (normalized === '3' || normalized.includes('BIRTH') || normalized.includes('DOB')) {
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_DOB)
    return
  }

  if (normalized === '4' || normalized.includes('RETURN')) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.RETURN_DATE,
      summary: 'Customer asked a return-date question by SMS.',
      replyBody: returnDateInfoSms(),
    })
    return
  }

  if (
    normalized === '2' ||
    normalized.includes('FIRST') ||
    normalized.includes('LAST') ||
    normalized.includes('DATE') ||
    normalized.includes('DAY') ||
    normalized.includes('ABSENCE')
  ) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
      summary: 'Customer asked to change first/last day off by SMS.',
      replyBody: dateChangeManualSms(),
    })
    return
  }

  if (normalized === '5' || normalized.includes('DIAGNOSIS') || normalized.includes('SYMPTOM')) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.DIAGNOSIS_SYMPTOMS_CONFIRM,
        category: SMS_SUPPORT_CATEGORY.DIAGNOSIS_SYMPTOMS,
      },
      diagnosisSymptomsConfirmSms()
    )
    return
  }

  if (
    normalized === '6' ||
    normalized.includes('PURPOSE') ||
    normalized.includes('WORK') ||
    normalized.includes('SCHOOL') ||
    normalized.includes('TRAVEL')
  ) {
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE)
    return
  }

  if (normalized === '7' || normalized.includes('NAME') || normalized.includes('SPELL')) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.NAME_CORRECTION_COLLECT,
        category: SMS_SUPPORT_CATEGORY.NAME_CORRECTION,
      },
      nameCorrectionPromptSms()
    )
    return
  }

  if (
    normalized === '8' ||
    normalized.includes('RESTRICTION') ||
    normalized.includes('ACCOMMODATION')
  ) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.RESTRICTIONS_CONFIRM,
        category: SMS_SUPPORT_CATEGORY.RESTRICTIONS_ACCOMMODATIONS,
      },
      restrictionsConfirmSms()
    )
    return
  }

  if (normalized === '9' || normalized.includes('OTHER')) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.OTHER_COLLECT_MESSAGE,
        category: SMS_SUPPORT_CATEGORY.OTHER,
      },
      askOtherMessageSms()
    )
    return
  }

  await reply(ticket, changeNoteMenuSms())
}

async function routeOtherMenu(ticket: SmsSupportTicket, body: string): Promise<void> {
  const normalized = normalizeSmsKeyword(body)

  if (normalized === '1' || normalized.includes('FORM')) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.ADDITIONAL_FORM,
      summary: 'Customer asked for an additional form by SMS.',
      replyBody: additionalFormManualSms(),
    })
    return
  }

  if (normalized === '2' || normalized.includes('REFUND')) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.REFUND,
      summary: 'Customer asked about a refund by SMS.',
      replyBody: refundManualSms(),
    })
    return
  }

  if (normalized === '3' || normalized.includes('OTHER')) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.OTHER_COLLECT_MESSAGE,
        category: SMS_SUPPORT_CATEGORY.OTHER,
      },
      askOtherMessageSms()
    )
    return
  }

  await reply(ticket, otherMenuSms())
}

async function startAutomationCategory(
  ticket: SmsSupportTicket,
  category: SmsSupportCategory
): Promise<void> {
  const collectState = stateForAutomationCategory(category)
  if (!collectState) {
    await moveToCsr(ticket, {
      category,
      summary: `${category} is not SMS-automated.`,
      replyBody: csrQueuedSms(),
    })
    return
  }

  const resolution = await resolveApprovedSubmission(ticket)
  if (resolution.status === 'none') {
    await moveToCsr(ticket, {
      category,
      summary: 'No approved note was found for this phone number.',
      replyBody: automationBlockedSms('we could not find an approved note for this phone'),
    })
    return
  }

  if (resolution.status === 'ambiguous') {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.COLLECT_SUBMISSION_REF,
        category,
        collectedData: {
          ...ticketCollectedData(ticket),
          pendingCategory: category,
          pendingState: collectState,
        },
      },
      askSubmissionReferenceSms()
    )
    return
  }

  await updateTicketAndReply(
    ticket.id,
    {
      submissionId: resolution.submission.id,
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: collectState,
      category,
      collectedData: {},
    },
    promptForState(collectState)
  )
}

async function handleSubmissionReference(
  ticket: SmsSupportTicket,
  body: string,
  providerMessageId?: string
): Promise<void> {
  const data = ticketCollectedData(ticket)
  if (!data.pendingCategory || !data.pendingState) {
    await updateTicketAndReply(
      ticket.id,
      {
        state: SMS_SUPPORT_STATE.INTRO_MENU,
        collectedData: {},
      },
      supportIntroMenuSms()
    )
    return
  }

  const submission = await findApprovedSubmissionByReference(ticket.phoneE164, body)
  if (!submission) {
    await reply(ticket, askSubmissionReferenceSms())
    return
  }

  if (providerMessageId) {
    await linkSmsMessageToSupportTicket(providerMessageId, {
      supportTicketId: ticket.id,
      submissionId: submission.id,
    })
  }

  const nextData: SmsSupportCollectedData = {}
  await updateTicketAndReply(
    ticket.id,
    {
      submissionId: submission.id,
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: data.pendingState,
      category: data.pendingCategory,
      collectedData: nextData,
    },
    promptForState(data.pendingState)
  )
}

async function collectDob(ticket: SmsSupportTicket, body: string): Promise<void> {
  const isoDate = parseUsDateToIso(body)
  if (!isoDate || !isIsoDateOnlyInSaneRange(isoDate, { minYear: 1900 })) {
    await reply(ticket, invalidDateSms())
    return
  }

  const submission = await getTicketSubmission(ticket)
  if (!submission) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
      summary: 'Birthday correction requested, but no linked approved note was found.',
      replyBody: automationBlockedSms('we could not find the approved note'),
    })
    return
  }

  const currentAdult = isAtLeastAge(formatDateUTC(submission.patientDateOfBirth), 18)
  const nextAdult = isAtLeastAge(isoDate, 18)
  if (currentAdult !== nextAdult) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
      summary: 'Birthday correction would change adult/minor status.',
      replyBody: automationBlockedSms('the birthday changes the adult/minor review status'),
    })
    return
  }

  await queueAutomation(ticket, {
    category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
    data: { patientDateOfBirth: isoDate },
  })
}

async function collectPurpose(ticket: SmsSupportTicket, body: string): Promise<void> {
  if (isLegalPurposeReply(body)) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
      summary: 'Customer asked to change note purpose to a legal matter by SMS.',
      replyBody: csrQueuedSms(),
    })
    return
  }

  const purpose = parsePurpose(body)
  if (!purpose) {
    await reply(ticket, invalidPurposeSms())
    return
  }

  await queueAutomation(ticket, {
    category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
    data: { notePurpose: purpose, otherNotePurpose: null },
  })
}

async function collectDiagnosisSymptomsConfirmation(
  ticket: SmsSupportTicket,
  body: string
): Promise<void> {
  if (!isConfirmReply(body)) {
    await reply(ticket, diagnosisSymptomsConfirmSms())
    return
  }

  await moveToCsr(ticket, {
    category: SMS_SUPPORT_CATEGORY.DIAGNOSIS_SYMPTOMS,
    summary: 'Customer confirmed they want admin review for a diagnosis/symptom change.',
    replyBody: csrQueuedSms(),
  })
}

async function collectNameCorrection(ticket: SmsSupportTicket, body: string): Promise<void> {
  const correctedName = body.trim().slice(0, 200)
  if (!correctedName) {
    await reply(ticket, nameCorrectionPromptSms())
    return
  }

  await moveToCsr(ticket, {
    category: SMS_SUPPORT_CATEGORY.NAME_CORRECTION,
    summary: `Name spelling correction requested: ${correctedName}`,
    alertSummary: 'Customer requested a name spelling correction. Details are in the ticket.',
    collectedData: { freeformMessage: correctedName },
    replyBody: csrQueuedSms(),
  })
}

async function collectRestrictionsConfirmation(
  ticket: SmsSupportTicket,
  body: string
): Promise<void> {
  if (!isConfirmReply(body)) {
    await reply(ticket, restrictionsConfirmSms())
    return
  }

  await moveToCsr(ticket, {
    category: SMS_SUPPORT_CATEGORY.RESTRICTIONS_ACCOMMODATIONS,
    summary: 'Customer wants admin review to remove "no restrictions" language.',
    replyBody: csrQueuedSms(),
  })
}

async function collectMissingNoteSpamCheck(ticket: SmsSupportTicket, body: string): Promise<void> {
  const normalized = normalizeSmsKeyword(body)

  if (normalized === '1' || normalized === 'YES' || normalized.includes('FOUND')) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.CLOSED,
        state: SMS_SUPPORT_STATE.CLOSED,
        category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
        adminSummary: 'Customer found the note after checking spam/junk.',
        closedAt: new Date(),
      },
      noteNotReceivedFoundSms()
    )
    return
  }

  if (normalized === '2' || normalized === 'NO' || normalized.includes('CANNOT')) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_COLLECT_EMAIL,
        category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
      },
      noteNotReceivedEmailSms()
    )
    return
  }

  await reply(ticket, noteNotReceivedSms())
}

async function collectMissingNoteEmail(ticket: SmsSupportTicket, body: string): Promise<void> {
  const email = body.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await reply(ticket, 'Please reply with a valid email address.')
    return
  }

  await moveToCsr(ticket, {
    category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
    summary: `Customer says note was not received. Corrected email: ${email}`,
    alertSummary: 'Customer says note was not received. Corrected email is in the ticket.',
    collectedData: { correctedEmail: email },
    replyBody: csrQueuedSms(),
  })
}

async function collectRefundReason(ticket: SmsSupportTicket, body: string): Promise<void> {
  await moveToCsr(ticket, {
    category: SMS_SUPPORT_CATEGORY.REFUND,
    summary: `Refund request: ${body.trim().slice(0, 500)}`,
    alertSummary: 'Customer requested a refund. Reason is in the ticket.',
    collectedData: { refundReason: body.trim().slice(0, 1000) },
    replyBody: csrQueuedSms(),
  })
}

async function collectOtherMessage(ticket: SmsSupportTicket, body: string): Promise<void> {
  await moveToCsr(ticket, {
    category: ticket.category || SMS_SUPPORT_CATEGORY.OTHER,
    summary: `Customer message: ${body.trim().slice(0, 500)}`,
    alertSummary: 'Customer sent a freeform support message. Details are in the ticket.',
    collectedData: { freeformMessage: body.trim().slice(0, 1000) },
    replyBody: csrQueuedSms(),
  })
}

async function queueAutomation(
  ticket: SmsSupportTicket,
  {
    category,
    data,
  }: {
    category: SmsSupportCategory
    data: SmsSupportCollectedData
  }
): Promise<void> {
  if (!ticket.submissionId) {
    await moveToCsr(ticket, {
      category,
      summary: 'Automation request had no linked approved note.',
      replyBody: automationBlockedSms('we could not find the approved note'),
    })
    return
  }

  const payload = automationPayloadForCollectedData({ category, ...data })
  let job: Awaited<ReturnType<typeof enqueueSupportAutomationJob>>
  try {
    job = await enqueueSupportAutomationJob({ ticketId: ticket.id, payload })
  } catch (error) {
    if (error instanceof SupportAutomationPayloadConflictError) {
      await reply(ticket, automationStillRunningSms(), 'SUPPORT_AUTOMATION_UPDATE')
      return
    }
    throw error
  }

  await updateTicketAndReply(
    ticket.id,
    {
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category,
      automationKind: payload.kind,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
      adminSummary: automationSummary(payload),
      failureReason: null,
      collectedData: data,
    },
    automationQueuedSms(),
    'SUPPORT_AUTOMATION_UPDATE'
  )

  await processSmsSupportJobNow(job.id, { workerId: `sms-inbound-${Date.now()}` })
}

async function moveToCsr(
  ticket: SmsSupportTicket,
  {
    category,
    summary,
    alertSummary,
    collectedData,
    replyBody,
  }: {
    category: SmsSupportCategory | string | null
    summary: string
    alertSummary?: string
    collectedData?: SmsSupportCollectedData
    replyBody: string
  }
): Promise<void> {
  const updatedTicket = await escalateSupportTicketToCsr(ticket.id, {
    category,
    adminSummary: summary,
    collectedData: {
      ...ticketCollectedData(ticket),
      ...(collectedData || {}),
    },
  })

  const replyDelivered = await reply(updatedTicket, replyBody, 'SUPPORT_CSR_ALERT', {
    alertOnFailure: false,
  })
  await alertSupportTicketNeedsCsr({
    ticketId: updatedTicket.id,
    phoneE164: updatedTicket.phoneE164,
    category: updatedTicket.category,
    submissionId: updatedTicket.submissionId,
    summary: replyDelivered
      ? alertSummary || summary
      : `Support SMS failed to send. Customer may not have received the latest reply. ${
          alertSummary || summary
        }`,
  })
}

async function findSafeSubmissionForPhone(phoneE164: string): Promise<{ id: string } | null> {
  const submissions = await findSmsSupportSubmissionCandidatesForPhone(phoneE164)

  const approved = submissions.filter(({ status }) => status === SubmissionStatus.APPROVED)
  if (approved.length === 1) return approved[0]
  if (approved.length > 1) return null

  const conversationMatches = submissions.filter(({ smsMessages }) => smsMessages.length > 0)
  if (conversationMatches.length === 1) return conversationMatches[0]

  return submissions.length === 1 ? submissions[0] : null
}

async function resolveApprovedSubmission(
  ticket: SmsSupportTicket
): Promise<
  { status: 'found'; submission: { id: string } } | { status: 'none' } | { status: 'ambiguous' }
> {
  if (ticket.submissionId) {
    const submission = await findApprovedSubmissionIdForSupportTicket(ticket.submissionId)
    return submission ? { status: 'found', submission } : { status: 'none' }
  }

  const submissions = await findLatestApprovedSubmissionIdsForSupportPhone(ticket.phoneE164)

  if (submissions.length === 0) return { status: 'none' }
  if (submissions.length === 1) return { status: 'found', submission: submissions[0] }
  return { status: 'ambiguous' }
}

async function findApprovedSubmissionByReference(phoneE164: string, reference: string) {
  const compact = normalizeSubmissionReferenceInput(reference)
  if (!compact) return null

  const normalizedMedicalRecordNumber = normalizeMedicalRecordNumber(compact)
  const idPrefix = compact.length === 8 ? compact.toLowerCase() : undefined
  const medicalRecordNumber = /^[A-Z0-9]{8}$/.test(normalizedMedicalRecordNumber)
    ? normalizedMedicalRecordNumber
    : undefined
  if (idPrefix === undefined && medicalRecordNumber === undefined) return null

  const matches = await findApprovedSupportSubmissionIdsByReference(phoneE164, {
    idPrefix,
    medicalRecordNumber,
  })

  return matches.length === 1 ? matches[0] : null
}

function normalizeSubmissionReferenceInput(reference: string): string {
  const compact = reference
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  if (compact.length > 8 && compact.startsWith('REFERENCE')) {
    return compact.slice('REFERENCE'.length)
  }

  if (compact.length > 8 && compact.startsWith('REF')) {
    return compact.slice(3)
  }

  return compact
}

async function getTicketSubmission(ticket: SmsSupportTicket) {
  if (!ticket.submissionId) return null

  return findApprovedSubmissionBirthDateForSupport(ticket.submissionId)
}

function categoryFromMessage(body: string): SmsSupportCategory | null {
  const normalized = normalizeSmsKeyword(body)

  if (normalized === '1' || includesAny(normalized, ['NOT RECEIVED', 'MISSING', 'EMAIL', 'SPAM'])) {
    return SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED
  }

  if (normalized === '3' || normalized.includes('OTHER') || normalized.includes('AGENT')) {
    return SMS_SUPPORT_CATEGORY.OTHER
  }

  if (normalized.includes('REFUND') || normalized.includes('MONEY')) {
    return SMS_SUPPORT_CATEGORY.REFUND
  }

  if (normalized.includes('FORM')) {
    return SMS_SUPPORT_CATEGORY.ADDITIONAL_FORM
  }

  if (normalized.includes('ISSUE') || normalized.includes('EVALUATION')) {
    return SMS_SUPPORT_CATEGORY.ISSUE_DATE
  }

  if (normalized.includes('DIAGNOSIS') || normalized.includes('SYMPTOM')) {
    return SMS_SUPPORT_CATEGORY.DIAGNOSIS_SYMPTOMS
  }

  if (normalized.includes('NAME') || normalized.includes('SPELL')) {
    return SMS_SUPPORT_CATEGORY.NAME_CORRECTION
  }

  if (normalized.includes('RESTRICTION') || normalized.includes('ACCOMMODATION')) {
    return SMS_SUPPORT_CATEGORY.RESTRICTIONS_ACCOMMODATIONS
  }

  if (normalized.includes('BIRTH') || normalized.includes('DOB')) {
    return SMS_SUPPORT_CATEGORY.CHANGE_DOB
  }

  if (normalized.includes('RETURN')) {
    return SMS_SUPPORT_CATEGORY.RETURN_DATE
  }

  if (
    normalized.includes('PURPOSE') ||
    normalized.includes('WORK') ||
    normalized.includes('SCHOOL') ||
    normalized.includes('TRAVEL')
  ) {
    return SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE
  }

  if (
    normalized.includes('DATE') ||
    normalized.includes('DAYS') ||
    normalized.includes('ABSENCE')
  ) {
    return SMS_SUPPORT_CATEGORY.CHANGE_DATES
  }

  return null
}

function stateForAutomationCategory(category: SmsSupportCategory): SmsSupportState | null {
  if (category === SMS_SUPPORT_CATEGORY.CHANGE_DOB) return SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT
  if (category === SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE) {
    return SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT
  }
  return null
}

function promptForState(state: SmsSupportState): string {
  if (state === SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT) return askDobSms()
  if (state === SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT) return askPurposeSms()
  if (state === SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_SPAM_CHECK) return noteNotReceivedSms()
  if (state === SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_COLLECT_EMAIL) return noteNotReceivedEmailSms()
  return supportIntroMenuSms()
}

function parsePurpose(body: string): string | null {
  const normalized = normalizeSmsKeyword(body)
  const hasWork = normalized.includes('WORK')
  const hasSchool = normalized.includes('SCHOOL')
  if (normalized === '3' || normalized.includes('BOTH') || (hasWork && hasSchool)) {
    return 'both'
  }
  if (normalized === '1' || hasWork) return 'work'
  if (normalized === '2' || hasSchool) return 'school'
  if (normalized === '4' || normalized.includes('TRAVEL')) return 'travel'
  return null
}

function isLegalPurposeReply(body: string): boolean {
  const normalized = normalizeSmsKeyword(body)
  return includesAny(normalized, ['LEGAL', 'JURY', 'COURT', 'PROBATION', 'ATTORNEY', 'LAWYER'])
}

function isConfirmReply(body: string): boolean {
  const normalized = normalizeSmsKeyword(body)
  return normalized === '1' || normalized === 'YES' || normalized === 'Y'
}

function parseUsDateToIso(value: string): string | null {
  const match = /^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/.exec(value)
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

function ticketCollectedData(ticket: SmsSupportTicket): SmsSupportCollectedData {
  if (!ticket.collectedData || typeof ticket.collectedData !== 'object') return {}
  if (Array.isArray(ticket.collectedData)) return {}
  return ticket.collectedData as SmsSupportCollectedData
}

async function updateTicketAndReply(
  ticketId: string,
  data: SupportTicketConversationUpdate,
  body: string,
  type: SupportReplySmsType = 'SUPPORT_REPLY'
): Promise<void> {
  const ticket = await updateSupportTicketConversation(ticketId, data)
  await reply(ticket, body, type)
}

async function reply(
  ticket: {
    id: string
    phoneE164: string
    submissionId?: string | null
    category?: string | null
  },
  body: string,
  type: SupportReplySmsType = 'SUPPORT_REPLY',
  { alertOnFailure = true }: { alertOnFailure?: boolean } = {}
): Promise<boolean> {
  const result = await sendSupportSms({
    ticketId: ticket.id,
    submissionId: ticket.submissionId,
    toPhone: ticket.phoneE164,
    type,
    body,
  })

  if (!result.success) {
    const failureReason = `Support SMS send failed: ${result.error || 'Unknown error'}`
    console.warn('SMS support reply failed:', {
      ticketId: ticket.id,
      error: result.error,
    })
    await cancelActiveAutomationJobs(ticket.id, 'Support SMS failed before automation completed')

    const failedTicket = await markSupportTicketReplyFailed(ticket.id, failureReason)

    if (alertOnFailure) {
      await alertSupportTicketNeedsCsr({
        ticketId: failedTicket.id,
        phoneE164: failedTicket.phoneE164,
        category: failedTicket.category,
        submissionId: failedTicket.submissionId,
        summary: 'Support SMS failed to send. Customer may not have received the latest prompt.',
      })
    }

    return false
  }

  return true
}

async function cancelActiveAutomationJobs(ticketId: string, lastError: string): Promise<void> {
  await failQueuedOrRunningSupportJobs(ticketId, { lastError, completedAt: new Date() })
}

function isHelpRequest(body: string): boolean {
  const normalized = normalizeSmsKeyword(body)
  return normalized === 'HELP' || normalized === 'MENU' || normalized === 'SUPPORT'
}

function isChangeNoteMenuRequest(body: string): boolean {
  const normalized = normalizeSmsKeyword(body)
  return (
    normalized === '2' ||
    (normalized.startsWith('2 ') && includesAny(normalized, ['CHANGE', 'NOTE'])) ||
    normalized === 'CHANGE' ||
    normalized === 'CHANGE NOTE' ||
    normalized === 'CHANGE MY NOTE'
  )
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle))
}
