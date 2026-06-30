import { Prisma, SubmissionStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { validateAbsenceDates } from '@/lib/date-validators'
import { isAtLeastAge, isIsoDateOnlyInSaneRange } from '@/lib/date-only'
import { formatDateUTC } from '@/lib/utils'
import { toE164UsPhone } from '@/lib/phone-utils'
import { normalizeMedicalRecordNumber } from '@/lib/note-verification'
import { normalizeSmsKeyword } from '@/lib/telnyx'
import {
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
  changeNoteMenuSms,
  csrQueuedSms,
  invalidDateSms,
  invalidPurposeSms,
  noteNotReceivedSms,
  supportIntroMenuSms,
} from '@/lib/sms-support-templates'
import { sendSupportSms } from '@/lib/sms-support-sms'
import { alertSupportTicketNeedsCsr } from '@/lib/sms-support-alerts'
import { automationPayloadForCollectedData, automationSummary } from '@/lib/sms-support-automation'
import {
  enqueueSupportAutomationJob,
  SupportAutomationPayloadConflictError,
} from '@/lib/sms-support-jobs'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
  type SmsSupportCategory,
  type SmsSupportCollectedData,
  type SmsSupportState,
} from '@/lib/sms-support-types'

type SupportTicket = Awaited<ReturnType<typeof findActiveTicket>>
type ConcreteSupportTicket = NonNullable<SupportTicket>
type SupportReplySmsType = 'SUPPORT_REPLY' | 'SUPPORT_AUTOMATION_UPDATE' | 'SUPPORT_CSR_ALERT'

const ACTIVE_TICKET_STATUSES = [
  SMS_SUPPORT_STATUS.OPEN,
  SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
  SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
  SMS_SUPPORT_STATUS.NEEDS_CSR,
]

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

  let ticket = await findActiveTicket(phoneE164)
  if (!ticket) {
    const matchedSubmission = await findSingleSubmissionForPhone(phoneE164)
    ticket = await prisma.smsSupportTicket.create({
      data: {
        phoneE164,
        submissionId: matchedSubmission?.id,
        status: SMS_SUPPORT_STATUS.OPEN,
        state: SMS_SUPPORT_STATE.INTRO_MENU,
        source: SMS_SUPPORT_SOURCE.INBOUND_SMS,
        lastInboundAt: receivedAt,
      },
    })
  } else {
    ticket = await prisma.smsSupportTicket.update({
      where: { id: ticket.id },
      data: {
        lastInboundAt: receivedAt,
        closedAt: null,
      },
    })
  }

  if (providerMessageId) {
    await prisma.smsMessage.updateMany({
      where: { providerMessageId },
      data: {
        supportTicketId: ticket.id,
        submissionId: ticket.submissionId ?? null,
      },
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
        collectedData: prismaJson({}),
      },
      supportIntroMenuSms()
    )
    return
  }

  await routeByState(ticket, trimmedBody, providerMessageId)
}

async function routeByState(
  ticket: ConcreteSupportTicket,
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
    case SMS_SUPPORT_STATE.COLLECT_SUBMISSION_REF:
      await handleSubmissionReference(ticket, body, providerMessageId)
      return
    case SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_COLLECT_EMAIL:
      await collectMissingNoteEmail(ticket, body)
      return
    case SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT:
      await collectDob(ticket, body)
      return
    case SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_FIRST:
      await collectFirstDayOff(ticket, body)
      return
    case SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_LAST:
      await collectLastDayOff(ticket, body)
      return
    case SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT:
      await collectPurpose(ticket, body)
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

async function routeIntroMenu(ticket: ConcreteSupportTicket, body: string): Promise<void> {
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
        state: SMS_SUPPORT_STATE.NOTE_NOT_RECEIVED_COLLECT_EMAIL,
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
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_DATES)
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE) {
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE)
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.REFUND) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.REFUND_COLLECT_REASON,
        category,
      },
      askRefundReasonSms()
    )
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.DIAGNOSIS_SYMPTOMS) {
    await moveToCsr(ticket, {
      category,
      summary: 'Customer asked to change diagnosis or symptoms by SMS.',
      replyBody: csrQueuedSms(),
    })
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.RETURN_DATE) {
    await moveToCsr(ticket, {
      category,
      summary: 'Customer asked a return-date question by SMS.',
      replyBody: csrQueuedSms(),
    })
    return
  }

  if (category === SMS_SUPPORT_CATEGORY.OTHER) {
    await updateTicketAndReply(
      ticket.id,
      {
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.OTHER_COLLECT_MESSAGE,
        category,
      },
      askOtherMessageSms()
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

async function routeChangeNoteMenu(ticket: ConcreteSupportTicket, body: string): Promise<void> {
  const normalized = normalizeSmsKeyword(body)

  if (normalized === '1' || normalized.includes('BIRTH') || normalized.includes('DOB')) {
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_DOB)
    return
  }

  if (normalized === '4' || normalized.includes('RETURN')) {
    await moveToCsr(ticket, {
      category: SMS_SUPPORT_CATEGORY.RETURN_DATE,
      summary: 'Customer asked a return-date question by SMS.',
      replyBody: csrQueuedSms(),
    })
    return
  }

  if (normalized === '2' || normalized.includes('DATE') || normalized.includes('DAY')) {
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_DATES)
    return
  }

  if (
    normalized === '3' ||
    normalized.includes('PURPOSE') ||
    normalized.includes('WORK') ||
    normalized.includes('SCHOOL') ||
    normalized.includes('TRAVEL')
  ) {
    await startAutomationCategory(ticket, SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE)
    return
  }

  if (normalized === '5' || normalized.includes('OTHER')) {
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

async function startAutomationCategory(
  ticket: ConcreteSupportTicket,
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
        collectedData: prismaJson({
          ...ticketCollectedData(ticket),
          pendingCategory: category,
          pendingState: collectState,
        }),
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
      collectedData: prismaJson({}),
    },
    promptForState(collectState)
  )
}

async function handleSubmissionReference(
  ticket: ConcreteSupportTicket,
  body: string,
  providerMessageId?: string
): Promise<void> {
  const data = ticketCollectedData(ticket)
  if (!data.pendingCategory || !data.pendingState) {
    await updateTicketAndReply(
      ticket.id,
      {
        state: SMS_SUPPORT_STATE.INTRO_MENU,
        collectedData: prismaJson({}),
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
    await prisma.smsMessage.updateMany({
      where: { providerMessageId },
      data: {
        supportTicketId: ticket.id,
        submissionId: submission.id,
      },
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
      collectedData: prismaJson(nextData),
    },
    promptForState(data.pendingState)
  )
}

async function collectDob(ticket: ConcreteSupportTicket, body: string): Promise<void> {
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

async function collectFirstDayOff(ticket: ConcreteSupportTicket, body: string): Promise<void> {
  const isoDate = parseUsDateToIso(body)
  if (!isoDate) {
    await reply(ticket, invalidDateSms())
    return
  }

  const firstDayErrors = validateAbsenceDates({
    firstDayOff: isoDate,
    lastDayOff: isoDate,
  }).filter((error) => error.field === 'firstDayOff')

  if (firstDayErrors[0]) {
    await reply(ticket, firstDayErrors[0].message)
    return
  }

  await updateTicketAndReply(
    ticket.id,
    {
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_LAST,
      collectedData: prismaJson({
        ...ticketCollectedData(ticket),
        firstDayOff: isoDate,
      }),
    },
    askLastDayOffSms()
  )
}

async function collectLastDayOff(ticket: ConcreteSupportTicket, body: string): Promise<void> {
  const isoDate = parseUsDateToIso(body)
  if (!isoDate) {
    await reply(ticket, invalidDateSms())
    return
  }

  const data = ticketCollectedData(ticket)
  if (!data.firstDayOff) {
    await updateTicketAndReply(
      ticket.id,
      {
        state: SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_FIRST,
        collectedData: prismaJson({}),
      },
      askFirstDayOffSms()
    )
    return
  }

  const errors = validateAbsenceDates({
    firstDayOff: data.firstDayOff,
    lastDayOff: isoDate,
  })

  if (errors.length > 0) {
    const firstDayError = errors.find((error) => error.field === 'firstDayOff')
    if (firstDayError) {
      await updateTicketAndReply(
        ticket.id,
        {
          status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
          state: SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_FIRST,
          collectedData: prismaJson({}),
        },
        `${firstDayError.message}. Please send the first day off again.`
      )
      return
    }

    await reply(ticket, errors[0].message)
    return
  }

  await queueAutomation(ticket, {
    category: SMS_SUPPORT_CATEGORY.CHANGE_DATES,
    data: {
      firstDayOff: data.firstDayOff,
      lastDayOff: isoDate,
    },
  })
}

async function collectPurpose(ticket: ConcreteSupportTicket, body: string): Promise<void> {
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

async function collectMissingNoteEmail(ticket: ConcreteSupportTicket, body: string): Promise<void> {
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

async function collectRefundReason(ticket: ConcreteSupportTicket, body: string): Promise<void> {
  await moveToCsr(ticket, {
    category: SMS_SUPPORT_CATEGORY.REFUND,
    summary: `Refund request: ${body.trim().slice(0, 500)}`,
    alertSummary: 'Customer requested a refund. Reason is in the ticket.',
    collectedData: { refundReason: body.trim().slice(0, 1000) },
    replyBody: csrQueuedSms(),
  })
}

async function collectOtherMessage(ticket: ConcreteSupportTicket, body: string): Promise<void> {
  await moveToCsr(ticket, {
    category: ticket.category || SMS_SUPPORT_CATEGORY.OTHER,
    summary: `Customer message: ${body.trim().slice(0, 500)}`,
    alertSummary: 'Customer sent a freeform support message. Details are in the ticket.',
    collectedData: { freeformMessage: body.trim().slice(0, 1000) },
    replyBody: csrQueuedSms(),
  })
}

async function queueAutomation(
  ticket: ConcreteSupportTicket,
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
  try {
    await enqueueSupportAutomationJob({ ticketId: ticket.id, payload })
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
      collectedData: prismaJson(data),
    },
    automationQueuedSms(),
    'SUPPORT_AUTOMATION_UPDATE'
  )
}

async function moveToCsr(
  ticket: ConcreteSupportTicket,
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
  const updatedTicket = await prisma.smsSupportTicket.update({
    where: { id: ticket.id },
    data: {
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category,
      adminSummary: summary,
      collectedData: prismaJson({
        ...ticketCollectedData(ticket),
        ...(collectedData || {}),
      }),
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

async function findActiveTicket(phoneE164: string) {
  return prisma.smsSupportTicket.findFirst({
    where: {
      phoneE164,
      status: { in: ACTIVE_TICKET_STATUSES },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

async function findSingleSubmissionForPhone(phoneE164: string): Promise<{ id: string } | null> {
  const submissions = await prisma.submission.findMany({
    where: { smsPhoneE164: phoneE164 },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 2,
  })

  return submissions.length === 1 ? submissions[0] : null
}

async function resolveApprovedSubmission(
  ticket: ConcreteSupportTicket
): Promise<
  { status: 'found'; submission: { id: string } } | { status: 'none' } | { status: 'ambiguous' }
> {
  if (ticket.submissionId) {
    const submission = await prisma.submission.findFirst({
      where: {
        id: ticket.submissionId,
        status: SubmissionStatus.APPROVED,
      },
      select: { id: true },
    })
    return submission ? { status: 'found', submission } : { status: 'none' }
  }

  const submissions = await prisma.submission.findMany({
    where: {
      smsPhoneE164: ticket.phoneE164,
      status: SubmissionStatus.APPROVED,
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 2,
  })

  if (submissions.length === 0) return { status: 'none' }
  if (submissions.length === 1) return { status: 'found', submission: submissions[0] }
  return { status: 'ambiguous' }
}

async function findApprovedSubmissionByReference(phoneE164: string, reference: string) {
  const compact = normalizeSubmissionReferenceInput(reference)
  if (!compact) return null

  const normalizedMedicalRecordNumber = normalizeMedicalRecordNumber(compact)
  const referenceFilters: Prisma.SubmissionWhereInput[] = []
  if (compact.length === 8) {
    referenceFilters.push({ id: { startsWith: compact.toLowerCase() } })
  }
  if (/^[A-Z0-9]{8}$/.test(normalizedMedicalRecordNumber)) {
    referenceFilters.push({
      noteVerifications: { some: { medicalRecordNumber: normalizedMedicalRecordNumber } },
    })
  }
  if (referenceFilters.length === 0) return null

  const matches = await prisma.submission.findMany({
    where: {
      smsPhoneE164: phoneE164,
      status: SubmissionStatus.APPROVED,
      OR: referenceFilters,
    },
    select: { id: true },
    take: 2,
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

async function getTicketSubmission(ticket: ConcreteSupportTicket) {
  if (!ticket.submissionId) return null

  return prisma.submission.findFirst({
    where: {
      id: ticket.submissionId,
      status: SubmissionStatus.APPROVED,
    },
    select: {
      id: true,
      patientDateOfBirth: true,
    },
  })
}

function categoryFromMessage(body: string): SmsSupportCategory | null {
  const normalized = normalizeSmsKeyword(body)

  if (normalized === '1' || includesAny(normalized, ['NOT RECEIVED', 'MISSING', 'EMAIL', 'SPAM'])) {
    return SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED
  }

  if (normalized === '3' || normalized.includes('REFUND') || normalized.includes('MONEY')) {
    return SMS_SUPPORT_CATEGORY.REFUND
  }

  if (normalized === '4' || normalized.includes('DIAGNOSIS') || normalized.includes('SYMPTOM')) {
    return SMS_SUPPORT_CATEGORY.DIAGNOSIS_SYMPTOMS
  }

  if (normalized === '5' || normalized.includes('OTHER') || normalized.includes('AGENT')) {
    return SMS_SUPPORT_CATEGORY.OTHER
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
  if (category === SMS_SUPPORT_CATEGORY.CHANGE_DATES) {
    return SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_FIRST
  }
  if (category === SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE) {
    return SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT
  }
  return null
}

function promptForState(state: SmsSupportState): string {
  if (state === SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT) return askDobSms()
  if (state === SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_FIRST) return askFirstDayOffSms()
  if (state === SMS_SUPPORT_STATE.CHANGE_DATES_COLLECT_LAST) return askLastDayOffSms()
  if (state === SMS_SUPPORT_STATE.CHANGE_PURPOSE_COLLECT) return askPurposeSms()
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

function parseUsDateToIso(value: string): string | null {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(value)
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

function ticketCollectedData(ticket: ConcreteSupportTicket): SmsSupportCollectedData {
  if (!ticket.collectedData || typeof ticket.collectedData !== 'object') return {}
  if (Array.isArray(ticket.collectedData)) return {}
  return ticket.collectedData as SmsSupportCollectedData
}

async function updateTicketAndReply(
  ticketId: string,
  data: Prisma.SmsSupportTicketUncheckedUpdateInput,
  body: string,
  type: SupportReplySmsType = 'SUPPORT_REPLY'
): Promise<void> {
  const ticket = await prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data,
  })
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

    const failedTicket = await prisma.smsSupportTicket.update({
      where: { id: ticket.id },
      data: {
        status: SMS_SUPPORT_STATUS.NEEDS_CSR,
        state: SMS_SUPPORT_STATE.CSR_REVIEW,
        failureReason,
        adminSummary: 'Support SMS failed to send. Staff should contact the customer manually.',
        closedAt: null,
      },
    })

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
  await prisma.smsSupportJob.updateMany({
    where: {
      ticketId,
      status: { in: [SMS_SUPPORT_JOB_STATUS.QUEUED, SMS_SUPPORT_JOB_STATUS.RUNNING] },
    },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError,
      completedAt: new Date(),
    },
  })
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

function prismaJson(value: SmsSupportCollectedData): Prisma.InputJsonObject {
  return { ...value } as Prisma.InputJsonObject
}
