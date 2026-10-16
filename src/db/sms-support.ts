import { Prisma } from '@prisma/client'
import prisma from './client'
import { isUniqueConstraintError } from './errors'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import type {
  JsonObject,
  JsonValue,
  SmsMessage,
  SmsPhoneState,
  SmsSupportJob,
  SmsSupportTicket,
  Submission,
} from './types'

const ACTIVE_TICKET_STATUSES = [
  SMS_SUPPORT_STATUS.OPEN,
  SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
  SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
  SMS_SUPPORT_STATUS.NEEDS_CSR,
]

const ACTIVE_JOB_STATUSES = [
  SMS_SUPPORT_JOB_STATUS.QUEUED,
  SMS_SUPPORT_JOB_STATUS.RUNNING,
  SMS_SUPPORT_JOB_STATUS.COMMITTING,
]

export const ACTIVE_AUTOMATION_STATUSES = [
  SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
  SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
] as const

const supportTicketListInclude = {
  submission: {
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      email: true,
      status: true,
      notePurpose: true,
      firstDayOff: true,
      lastDayOff: true,
    },
  },
  messages: {
    select: {
      id: true,
      direction: true,
      body: true,
      providerStatus: true,
      createdAt: true,
      receivedAt: true,
      sentAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  jobs: {
    select: {
      id: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.SmsSupportTicketInclude

const supportTicketDetailInclude = {
  submission: {
    select: {
      id: true,
      patientFirstName: true,
      patientLastName: true,
      patientDateOfBirth: true,
      email: true,
      phone: true,
      status: true,
      notePurpose: true,
      otherNotePurpose: true,
      firstDayOff: true,
      lastDayOff: true,
      approvalEmailSentAt: true,
      updatedAt: true,
    },
  },
  messages: {
    select: {
      id: true,
      type: true,
      direction: true,
      to: true,
      from: true,
      body: true,
      providerStatus: true,
      errorCode: true,
      errorMessage: true,
      sentAt: true,
      receivedAt: true,
      finalizedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  jobs: {
    select: {
      id: true,
      kind: true,
      status: true,
      attempts: true,
      lastError: true,
      runAfter: true,
      lockedAt: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.SmsSupportTicketInclude

export type SupportTicketListItem = SmsSupportTicket & {
  submission: Pick<
    Submission,
    | 'id'
    | 'patientFirstName'
    | 'patientLastName'
    | 'email'
    | 'status'
    | 'notePurpose'
    | 'firstDayOff'
    | 'lastDayOff'
  > | null
  messages: Pick<
    SmsMessage,
    'id' | 'direction' | 'body' | 'providerStatus' | 'createdAt' | 'receivedAt' | 'sentAt'
  >[]
  jobs: Pick<SmsSupportJob, 'id' | 'status' | 'attempts' | 'lastError' | 'createdAt'>[]
}

export type SupportTicketDetail = SmsSupportTicket & {
  submission: Pick<
    Submission,
    | 'id'
    | 'patientFirstName'
    | 'patientLastName'
    | 'patientDateOfBirth'
    | 'email'
    | 'phone'
    | 'status'
    | 'notePurpose'
    | 'otherNotePurpose'
    | 'firstDayOff'
    | 'lastDayOff'
    | 'approvalEmailSentAt'
    | 'updatedAt'
  > | null
  messages: Pick<
    SmsMessage,
    | 'id'
    | 'type'
    | 'direction'
    | 'to'
    | 'from'
    | 'body'
    | 'providerStatus'
    | 'errorCode'
    | 'errorMessage'
    | 'sentAt'
    | 'receivedAt'
    | 'finalizedAt'
    | 'createdAt'
  >[]
  jobs: Pick<
    SmsSupportJob,
    | 'id'
    | 'kind'
    | 'status'
    | 'attempts'
    | 'lastError'
    | 'runAfter'
    | 'lockedAt'
    | 'completedAt'
    | 'createdAt'
  >[]
}

export type SupportTicketConversationUpdate = {
  submissionId?: string
  status?: string
  state?: string
  category?: string | null
  automationKind?: string
  automationStatus?: string
  adminSummary?: string
  failureReason?: string | null
  collectedData?: JsonObject
  closedAt?: Date | null
}

export type SmsSupportJobWithTicket = SmsSupportJob & { ticket: SmsSupportTicket }

export async function findSmsPhoneOptOut(
  phoneE164: string
): Promise<Pick<SmsPhoneState, 'optedOutAt'> | null> {
  return prisma.smsPhoneState.findUnique({
    where: { phoneE164 },
    select: { optedOutAt: true },
  })
}

export async function findSmsPhoneConsentState(
  phoneE164: string
): Promise<Pick<SmsPhoneState, 'optedOutAt' | 'lastOptInAt'> | null> {
  return prisma.smsPhoneState.findUnique({
    where: { phoneE164 },
    select: { optedOutAt: true, lastOptInAt: true },
  })
}

export async function recordSmsPhoneOptOut(phoneE164: string, optedOutAt: Date): Promise<void> {
  await prisma.smsPhoneState.upsert({
    where: { phoneE164 },
    update: { optedOutAt },
    create: { phoneE164, optedOutAt },
  })
}

export async function recordSmsPhoneOptIn(phoneE164: string, lastOptInAt: Date): Promise<void> {
  await prisma.smsPhoneState.upsert({
    where: { phoneE164 },
    update: {
      optedOutAt: null,
      lastOptInAt,
    },
    create: {
      phoneE164,
      optedOutAt: null,
      lastOptInAt,
    },
  })
}

export async function createOutboundSmsMessage({
  submissionId,
  supportTicketId,
  type,
  to,
  from,
  body,
}: {
  submissionId?: string
  supportTicketId?: string
  type: string
  to: string
  from: string
  body: string
}): Promise<SmsMessage> {
  return prisma.smsMessage.create({
    data: {
      submissionId,
      supportTicketId,
      type,
      direction: 'outbound',
      to,
      from,
      body,
      providerStatus: 'queued',
    },
  })
}

export async function recordSmsMessageProviderRejection(
  id: string,
  { errorCode, errorMessage }: { errorCode: string; errorMessage: string }
): Promise<void> {
  await prisma.smsMessage.update({
    where: { id },
    data: {
      providerStatus: 'sending_failed',
      errorCode,
      errorMessage,
      finalizedAt: new Date(),
    },
  })
}

export async function recordSmsMessageAccepted(
  id: string,
  {
    providerMessageId,
    providerStatus,
    providerSentAt,
  }: { providerMessageId: string | undefined; providerStatus: string; providerSentAt?: string }
): Promise<void> {
  await prisma.smsMessage.update({
    where: { id },
    data: {
      providerMessageId,
      providerStatus,
      sentAt: providerSentAt ? new Date(providerSentAt) : new Date(),
    },
  })
}

export async function recordSmsMessageSendError(id: string, error: unknown): Promise<void> {
  await prisma.smsMessage.update({
    where: { id },
    data: {
      providerStatus: 'sending_failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown Telnyx send error',
      finalizedAt: new Date(),
    },
  })
}

export async function upsertInboundSmsMessage({
  providerMessageId,
  submissionId,
  to,
  from,
  body,
  providerStatus,
  receivedAt,
}: {
  providerMessageId: string
  submissionId: string | undefined
  to: string | null
  from: string | null
  body: string
  providerStatus: string | undefined
  receivedAt: Date
}): Promise<void> {
  await prisma.smsMessage.upsert({
    where: { providerMessageId },
    update: {
      providerStatus,
      receivedAt,
    },
    create: {
      submissionId,
      type: 'INBOUND',
      direction: 'inbound',
      to,
      from,
      body,
      providerMessageId,
      providerStatus,
      receivedAt,
    },
  })
}

export async function recordSmsMessageSent(
  providerMessageId: string,
  { providerStatus, sentAt }: { providerStatus: string; sentAt: Date }
): Promise<void> {
  await prisma.smsMessage.updateMany({
    where: {
      providerMessageId,
      finalizedAt: null,
    },
    data: {
      providerStatus,
      sentAt,
    },
  })
}

export async function recordSmsMessageFinalized(
  providerMessageId: string,
  {
    providerStatus,
    errorCode,
    errorMessage,
    finalizedAt,
  }: {
    providerStatus: string
    errorCode: string | null
    errorMessage: string | null
    finalizedAt: Date
  }
): Promise<number> {
  const result = await prisma.smsMessage.updateMany({
    where: { providerMessageId },
    data: {
      providerStatus,
      errorCode,
      errorMessage,
      finalizedAt,
    },
  })
  return result.count
}

export async function findSmsMessageSupportHandledAt(
  providerMessageId: string
): Promise<Pick<SmsMessage, 'supportHandledAt'> | null> {
  return prisma.smsMessage.findUnique({
    where: { providerMessageId },
    select: { supportHandledAt: true },
  })
}

export async function markSmsMessageSupportHandled(providerMessageId: string): Promise<void> {
  await prisma.smsMessage.updateMany({
    where: { providerMessageId },
    data: { supportHandledAt: new Date() },
  })
}

export async function linkSmsMessageToSupportTicket(
  providerMessageId: string,
  { supportTicketId, submissionId }: { supportTicketId: string; submissionId: string | null }
): Promise<void> {
  await prisma.smsMessage.updateMany({
    where: { providerMessageId },
    data: {
      supportTicketId,
      submissionId,
    },
  })
}

export async function findActiveSupportTicketForPhone(
  phoneE164: string
): Promise<SmsSupportTicket | null> {
  return prisma.smsSupportTicket.findFirst({
    where: {
      phoneE164,
      status: { in: ACTIVE_TICKET_STATUSES },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function findActiveSupportTicketSummaryForPhone(
  phoneE164: string
): Promise<Pick<SmsSupportTicket, 'id' | 'status' | 'submissionId'> | null> {
  return prisma.smsSupportTicket.findFirst({
    where: {
      phoneE164,
      status: { in: ACTIVE_TICKET_STATUSES },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, status: true, submissionId: true },
  })
}

export async function createInboundSupportTicket({
  phoneE164,
  submissionId,
  lastInboundAt,
}: {
  phoneE164: string
  submissionId: string | undefined
  lastInboundAt: Date
}): Promise<SmsSupportTicket> {
  return prisma.smsSupportTicket.create({
    data: {
      phoneE164,
      submissionId,
      status: SMS_SUPPORT_STATUS.OPEN,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      source: SMS_SUPPORT_SOURCE.INBOUND_SMS,
      lastInboundAt,
    },
  })
}

export async function createAdminSupportTicket({
  phoneE164,
  submissionId,
  adminSummary,
}: {
  phoneE164: string
  submissionId: string
  adminSummary: string
}): Promise<Pick<SmsSupportTicket, 'id'>> {
  return prisma.smsSupportTicket.create({
    data: {
      phoneE164,
      submissionId,
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      category: SMS_SUPPORT_CATEGORY.OTHER,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      source: SMS_SUPPORT_SOURCE.ADMIN_CREATED,
      adminSummary,
    },
    select: { id: true },
  })
}

export async function recordSupportTicketInbound(
  ticketId: string,
  { matchedSubmissionId, lastInboundAt }: { matchedSubmissionId?: string; lastInboundAt: Date }
): Promise<SmsSupportTicket> {
  return prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      ...(matchedSubmissionId ? { submissionId: matchedSubmissionId } : {}),
      lastInboundAt,
      closedAt: null,
    },
  })
}

export async function updateSupportTicketConversation(
  ticketId: string,
  update: SupportTicketConversationUpdate
): Promise<SmsSupportTicket> {
  return prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: update as Prisma.SmsSupportTicketUncheckedUpdateInput,
  })
}

export async function escalateSupportTicketToCsr(
  ticketId: string,
  {
    category,
    adminSummary,
    collectedData,
  }: { category: string | null; adminSummary: string; collectedData: JsonObject }
): Promise<SmsSupportTicket> {
  return prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category,
      adminSummary,
      collectedData: collectedData as Prisma.InputJsonObject,
    },
  })
}

export async function markSupportTicketReplyFailed(
  ticketId: string,
  failureReason: string
): Promise<SmsSupportTicket> {
  return prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      failureReason,
      adminSummary: 'Support SMS failed to send. Admin should contact the customer manually.',
      closedAt: null,
    },
  })
}

export async function assignSupportTicketSubmission(
  ticketId: string,
  submissionId: string
): Promise<void> {
  await prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: { submissionId },
  })
}

export async function findSupportTicketsWithStatus(
  status: string
): Promise<SupportTicketListItem[]> {
  return prisma.smsSupportTicket.findMany({
    where: { status },
    include: supportTicketListInclude,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
}

export async function findActiveSupportTicketsForQueue(): Promise<SupportTicketListItem[]> {
  return prisma.smsSupportTicket.findMany({
    where: { status: { in: ACTIVE_TICKET_STATUSES } },
    include: supportTicketListInclude,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
}

export async function findClosedSupportTicketsForQueue(
  take: number
): Promise<SupportTicketListItem[]> {
  return prisma.smsSupportTicket.findMany({
    where: { status: SMS_SUPPORT_STATUS.CLOSED },
    include: supportTicketListInclude,
    orderBy: { updatedAt: 'desc' },
    take,
  })
}

export async function findSupportTicketDetail(
  ticketId: string
): Promise<SupportTicketDetail | null> {
  return prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    include: supportTicketDetailInclude,
  })
}

export async function findSupportTicketContact(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'id' | 'phoneE164' | 'submissionId'> | null> {
  return prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      phoneE164: true,
      submissionId: true,
    },
  })
}

export async function findSupportTicketLastOutboundAt(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'lastOutboundAt'> | null> {
  return prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    select: { lastOutboundAt: true },
  })
}

export async function recordSupportTicketOutbound(ticketId: string): Promise<void> {
  await prisma.smsSupportTicket.updateMany({
    where: { id: ticketId },
    data: { lastOutboundAt: new Date() },
  })
}

export async function findSupportTicketCsrAlert(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'csrAlertedAt'> | null> {
  return prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    select: { csrAlertedAt: true },
  })
}

export async function markSupportTicketCsrAlerted(ticketId: string): Promise<void> {
  await prisma.smsSupportTicket.updateMany({
    where: { id: ticketId, csrAlertedAt: null },
    data: { csrAlertedAt: new Date() },
  })
}

export async function markSupportTicketAdminReplied(ticketId: string): Promise<void> {
  await prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.OPEN,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      adminSummary: 'Admin replied by SMS.',
      csrAlertedAt: null,
    },
  })
}

export async function markSupportTicketAdminReplyFailed(
  ticketId: string,
  failureReason: string
): Promise<void> {
  await prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      adminSummary: 'Admin reply failed to send by SMS.',
      failureReason,
    },
  })
}

export async function closeSupportTicketByAdmin(
  ticketId: string,
  closedAt: Date
): Promise<Pick<SmsSupportTicket, 'submissionId'>> {
  return prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.CLOSED,
      state: SMS_SUPPORT_STATE.CLOSED,
      closedAt,
    },
    select: { submissionId: true },
  })
}

export async function returnSupportTicketToCsrReview(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'submissionId'>> {
  return prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      closedAt: null,
    },
    select: { submissionId: true },
  })
}

export async function findSupportTicketForAutomationRetry(
  ticketId: string
): Promise<Pick<
  SmsSupportTicket,
  'id' | 'automationKind' | 'automationStatus' | 'collectedData' | 'status'
> | null> {
  return prisma.smsSupportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      automationKind: true,
      automationStatus: true,
      collectedData: true,
      status: true,
    },
  })
}

export async function startSupportAutomationRetry(
  ticketId: string,
  retrySummary: string | null
): Promise<void> {
  await prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
      adminSummary: retrySummary ? `Retry started: ${retrySummary}` : 'Retry started.',
      failureReason: null,
      retryCount: { increment: 1 },
    },
  })
}

export async function escalateSupportTicketAfterAutomationFailure(
  ticketId: string,
  failureReason: string
): Promise<SmsSupportTicket> {
  return prisma.smsSupportTicket.update({
    where: { id: ticketId },
    data: {
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: 'CSR_REVIEW',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
      failureReason,
    },
  })
}

export async function claimSupportTicketAutomationRun(ticketId: string): Promise<number> {
  const claimedTicket = await prisma.smsSupportTicket.updateMany({
    where: {
      id: ticketId,
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: {
        in: [...ACTIVE_AUTOMATION_STATUSES],
      },
    },
    data: {
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
      failureReason: null,
    },
  })
  return claimedTicket.count
}

export async function closeSupportTicketAfterAutomation(
  ticketId: string,
  adminSummary: string
): Promise<void> {
  await prisma.smsSupportTicket.updateMany({
    where: {
      id: ticketId,
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
    },
    data: {
      status: SMS_SUPPORT_STATUS.CLOSED,
      state: 'CLOSED',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED,
      adminSummary,
      failureReason: null,
      closedAt: new Date(),
    },
  })
}

export async function createSupportAutomationJob({
  ticketId,
  payload,
}: {
  ticketId: string
  payload: JsonObject
}): Promise<SmsSupportJob | null> {
  try {
    return await prisma.smsSupportJob.create({
      data: {
        ticketId,
        kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
        status: SMS_SUPPORT_JOB_STATUS.QUEUED,
        payload: payload as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    return null
  }
}

export async function createRetrySupportAutomationJob({
  ticketId,
  payload,
}: {
  ticketId: string
  payload: JsonValue | null
}): Promise<SmsSupportJob> {
  return prisma.smsSupportJob.create({
    data: {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: payload as Prisma.InputJsonValue,
    },
  })
}

export async function findActiveSupportAutomationJob(
  ticketId: string
): Promise<SmsSupportJob | null> {
  return prisma.smsSupportJob.findFirst({
    where: {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findActiveSupportAutomationJobId(
  ticketId: string
): Promise<Pick<SmsSupportJob, 'id'> | null> {
  return prisma.smsSupportJob.findFirst({
    where: {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    select: { id: true },
  })
}

export async function findLatestSupportAutomationJob(
  ticketId: string
): Promise<SmsSupportJob | null> {
  return prisma.smsSupportJob.findFirst({
    where: {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findRunnableQueuedSupportJob(
  jobId: string
): Promise<Pick<SmsSupportJob, 'id' | 'ticketId'> | null> {
  return prisma.smsSupportJob.findFirst({
    where: {
      id: jobId,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      runAfter: { lte: new Date() },
      ticket: {
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        automationStatus: {
          in: [SMS_SUPPORT_AUTOMATION_STATUS.QUEUED, SMS_SUPPORT_AUTOMATION_STATUS.RUNNING],
        },
      },
    },
    select: {
      id: true,
      ticketId: true,
    },
  })
}

export async function findRunnableQueuedSupportJobs(limit: number): Promise<SmsSupportJob[]> {
  return prisma.smsSupportJob.findMany({
    where: {
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      runAfter: { lte: new Date() },
      ticket: {
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        automationStatus: {
          in: [SMS_SUPPORT_AUTOMATION_STATUS.QUEUED, SMS_SUPPORT_AUTOMATION_STATUS.RUNNING],
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

export async function requeueStaleRunningSupportJobs(staleBefore: Date): Promise<void> {
  await prisma.smsSupportJob.updateMany({
    where: {
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: { lt: staleBefore },
    },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      lockedAt: null,
      lockedBy: null,
      lastError: 'Recovered stale running job lock',
      runAfter: new Date(),
    },
  })
}

export async function findStaleCommittingSupportJobs(
  staleBefore: Date,
  limit: number
): Promise<SmsSupportJobWithTicket[]> {
  return prisma.smsSupportJob.findMany({
    where: {
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      lockedAt: { lt: staleBefore },
    },
    include: { ticket: true },
    take: limit,
  })
}

export async function failStaleCommittingSupportJob(
  jobId: string,
  { staleBefore, lastError }: { staleBefore: Date; lastError: string }
): Promise<number> {
  const claimed = await prisma.smsSupportJob.updateMany({
    where: {
      id: jobId,
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      lockedAt: { lt: staleBefore },
    },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError,
      completedAt: new Date(),
    },
  })
  return claimed.count
}

export async function claimQueuedSupportJob(jobId: string, workerId: string): Promise<number> {
  const claimed = await prisma.smsSupportJob.updateMany({
    where: {
      id: jobId,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
    },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: { increment: 1 },
    },
  })
  return claimed.count
}

export async function completeSupportJob(jobId: string): Promise<void> {
  await prisma.smsSupportJob.update({
    where: { id: jobId },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  })
}

export async function failSupportJob(jobId: string, lastError: string): Promise<void> {
  await prisma.smsSupportJob.update({
    where: { id: jobId },
    data: {
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError,
      completedAt: new Date(),
    },
  })
}

export async function failQueuedOrRunningSupportJobs(
  ticketId: string,
  { lastError, completedAt }: { lastError: string; completedAt: Date }
): Promise<void> {
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
      completedAt,
    },
  })
}

export async function findCommittingSupportJob(
  ticketId: string
): Promise<Pick<SmsSupportJob, 'id'> | null> {
  return prisma.smsSupportJob.findFirst({
    where: {
      ticketId,
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
    },
    select: { id: true },
  })
}

export async function findSupportJobWithTicket(
  jobId: string
): Promise<SmsSupportJobWithTicket | null> {
  return prisma.smsSupportJob.findUnique({
    where: { id: jobId },
    include: { ticket: true },
  })
}

export async function findSupportJobStatus(
  jobId: string
): Promise<Pick<SmsSupportJob, 'status'> | null> {
  return prisma.smsSupportJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  })
}

export async function findSupportTicketIdsByStatus(
  status: SmsSupportTicket['status'],
  take: number
): Promise<Pick<SmsSupportTicket, 'id'>[]> {
  return prisma.smsSupportTicket.findMany({
    where: { status },
    select: { id: true },
    take,
  })
}
