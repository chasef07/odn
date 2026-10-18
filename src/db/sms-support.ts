import { db } from './pool'
import { array, sql, type Sql } from './sql'
import { insert, select, selectAll, set, type Patch } from './table'
import {
  smsMessages,
  smsPhoneStates,
  smsSupportJobs,
  smsSupportTickets,
  submissions,
} from './tables'
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

const listSubmissionKeys = [
  'id',
  'patientFirstName',
  'patientLastName',
  'email',
  'status',
  'notePurpose',
  'firstDayOff',
  'lastDayOff',
] as const

const listMessageKeys = [
  'id',
  'direction',
  'body',
  'providerStatus',
  'createdAt',
  'receivedAt',
  'sentAt',
] as const

const listJobKeys = ['id', 'status', 'attempts', 'lastError', 'createdAt'] as const

const detailSubmissionKeys = [
  'id',
  'patientFirstName',
  'patientLastName',
  'patientDateOfBirth',
  'email',
  'phone',
  'status',
  'notePurpose',
  'otherNotePurpose',
  'firstDayOff',
  'lastDayOff',
  'approvalEmailSentAt',
  'updatedAt',
] as const

const detailMessageKeys = [
  'id',
  'type',
  'direction',
  'to',
  'from',
  'body',
  'providerStatus',
  'errorCode',
  'errorMessage',
  'sentAt',
  'receivedAt',
  'finalizedAt',
  'createdAt',
] as const

const detailJobKeys = [
  'id',
  'kind',
  'status',
  'attempts',
  'lastError',
  'runAfter',
  'lockedAt',
  'completedAt',
  'createdAt',
] as const

export type SupportTicketListItem = SmsSupportTicket & {
  submission: Pick<Submission, (typeof listSubmissionKeys)[number]> | null
  messages: Pick<SmsMessage, (typeof listMessageKeys)[number]>[]
  jobs: Pick<SmsSupportJob, (typeof listJobKeys)[number]>[]
}

export type SupportTicketDetail = SmsSupportTicket & {
  submission: Pick<Submission, (typeof detailSubmissionKeys)[number]> | null
  messages: Pick<SmsMessage, (typeof detailMessageKeys)[number]>[]
  jobs: Pick<SmsSupportJob, (typeof detailJobKeys)[number]>[]
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

const JOINED = 'joined'

type Joined = typeof JOINED

type Own<R> = { [K in keyof R as K extends `${Joined}${string}` ? never : K]: R[K] }

type Nested<R> = {
  [K in keyof R as K extends `${Joined}${infer Rest}` ? Uncapitalize<Rest> : never]: R[K]
}

function nest<R extends object, N extends string>(row: R, name: N): Own<R> & Record<N, Nested<R>>
function nest<R extends object, N extends string>(
  row: R,
  name: N,
  optional: true
): Own<R> & Record<N, Nested<R> | null>
function nest(row: object, name: string, optional = false): object {
  const own: Record<string, unknown> = {}
  const nested: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith(JOINED)) own[key] = value
    else {
      const rest = key.slice(JOINED.length)
      nested[rest.charAt(0).toLowerCase() + rest.slice(1)] = value
    }
  }
  return { ...own, [name]: optional && nested.id === null ? null : nested }
}

function groupBy<K extends string, R extends Record<K, string | null>>(
  rows: R[],
  key: K
): Map<R[K], Omit<R, K>[]> {
  const groups = new Map<R[K], Omit<R, K>[]>()
  for (const { [key]: owner, ...rest } of rows) {
    groups.set(owner, [...(groups.get(owner) ?? []), rest])
  }
  return groups
}

const ticketWithSubmission = <K extends keyof Submission & string>(keys: readonly K[]) =>
  sql`${selectAll(smsSupportTickets, { alias: 't' })}, ${select(submissions, keys, { alias: 's', prefix: JOINED })}
    FROM sms_support_tickets t LEFT JOIN submissions s ON s.id = t.submission_id`

const jobWithTicket = sql`${selectAll(smsSupportJobs, { alias: 'j' })}, ${select(smsSupportTickets, smsSupportTickets.keys, { alias: 't', prefix: JOINED })}
  FROM sms_support_jobs j JOIN sms_support_tickets t ON t.id = j.ticket_id`

const runnableJob = () => sql`j.status = ${SMS_SUPPORT_JOB_STATUS.QUEUED}
  AND j.run_after <= ${new Date()}
  AND t.status = ${SMS_SUPPORT_STATUS.RUNNING_AUTOMATION}
  AND t.automation_status = ANY(${array(ACTIVE_AUTOMATION_STATUSES)})`

async function updateMessage(id: string, patch: Patch<SmsMessage>): Promise<void> {
  const updated = await db.affected(
    sql`UPDATE sms_messages SET ${set(smsMessages, patch)} WHERE id = ${id}`
  )
  if (updated === 0) throw new Error(`SMS message ${id} not found`)
}

async function updateTicket(
  ticketId: string,
  patch: Patch<SmsSupportTicket>
): Promise<SmsSupportTicket> {
  const ticket = await db.one(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, patch)} WHERE id = ${ticketId} RETURNING ${selectAll(smsSupportTickets)}`
  )
  if (!ticket) throw new Error(`Support ticket ${ticketId} not found`)
  return ticket
}

async function updateJob(jobId: string, patch: Patch<SmsSupportJob>): Promise<void> {
  const updated = await db.affected(
    sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, patch)} WHERE id = ${jobId}`
  )
  if (updated === 0) throw new Error(`Support job ${jobId} not found`)
}

export async function findSmsPhoneOptOut(
  phoneE164: string
): Promise<Pick<SmsPhoneState, 'optedOutAt'> | null> {
  return db.one(
    sql`SELECT ${select(smsPhoneStates, ['optedOutAt'])} FROM sms_phone_states WHERE phone_e164 = ${phoneE164}`
  )
}

export async function findSmsPhoneConsentState(
  phoneE164: string
): Promise<Pick<SmsPhoneState, 'optedOutAt' | 'lastOptInAt'> | null> {
  return db.one(
    sql`SELECT ${select(smsPhoneStates, ['optedOutAt', 'lastOptInAt'])} FROM sms_phone_states WHERE phone_e164 = ${phoneE164}`
  )
}

export async function recordSmsPhoneOptOut(phoneE164: string, optedOutAt: Date): Promise<void> {
  await db.affected(
    sql`${insert(smsPhoneStates, { phoneE164, optedOutAt })} ON CONFLICT (phone_e164) DO UPDATE SET ${set(smsPhoneStates, { optedOutAt })}`
  )
}

export async function recordSmsPhoneOptIn(phoneE164: string, lastOptInAt: Date): Promise<void> {
  await db.affected(
    sql`${insert(smsPhoneStates, { phoneE164, optedOutAt: null, lastOptInAt })} ON CONFLICT (phone_e164) DO UPDATE SET ${set(smsPhoneStates, { optedOutAt: null, lastOptInAt })}`
  )
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
  const [message] = await db.rows(
    sql`${insert(smsMessages, { submissionId, supportTicketId, type, direction: 'outbound', to, from, body, providerStatus: 'queued' })} RETURNING ${selectAll(smsMessages)}`
  )
  return message
}

export async function recordSmsMessageProviderRejection(
  id: string,
  { errorCode, errorMessage }: { errorCode: string; errorMessage: string }
): Promise<void> {
  await updateMessage(id, {
    providerStatus: 'sending_failed',
    errorCode,
    errorMessage,
    finalizedAt: new Date(),
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
  await updateMessage(id, {
    providerMessageId,
    providerStatus,
    sentAt: providerSentAt ? new Date(providerSentAt) : new Date(),
  })
}

export async function recordSmsMessageSendError(id: string, error: unknown): Promise<void> {
  await updateMessage(id, {
    providerStatus: 'sending_failed',
    errorMessage: error instanceof Error ? error.message : 'Unknown Telnyx send error',
    finalizedAt: new Date(),
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
  await db.affected(
    sql`${insert(smsMessages, { submissionId, type: 'INBOUND', direction: 'inbound', to, from, body, providerMessageId, providerStatus, receivedAt })}
      ON CONFLICT (provider_message_id) DO UPDATE SET ${set(smsMessages, { providerStatus, receivedAt })}`
  )
}

export async function recordSmsMessageSent(
  providerMessageId: string,
  { providerStatus, sentAt }: { providerStatus: string; sentAt: Date }
): Promise<void> {
  await db.affected(
    sql`UPDATE sms_messages SET ${set(smsMessages, { providerStatus, sentAt })} WHERE provider_message_id = ${providerMessageId} AND finalized_at IS NULL`
  )
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
  return db.affected(
    sql`UPDATE sms_messages SET ${set(smsMessages, { providerStatus, errorCode, errorMessage, finalizedAt })} WHERE provider_message_id = ${providerMessageId}`
  )
}

export async function findSmsMessageSupportHandledAt(
  providerMessageId: string
): Promise<Pick<SmsMessage, 'supportHandledAt'> | null> {
  return db.one(
    sql`SELECT ${select(smsMessages, ['supportHandledAt'])} FROM sms_messages WHERE provider_message_id = ${providerMessageId}`
  )
}

export async function markSmsMessageSupportHandled(providerMessageId: string): Promise<void> {
  await db.affected(
    sql`UPDATE sms_messages SET ${set(smsMessages, { supportHandledAt: new Date() })} WHERE provider_message_id = ${providerMessageId}`
  )
}

export async function linkSmsMessageToSupportTicket(
  providerMessageId: string,
  { supportTicketId, submissionId }: { supportTicketId: string; submissionId: string | null }
): Promise<void> {
  await db.affected(
    sql`UPDATE sms_messages SET ${set(smsMessages, { supportTicketId, submissionId })} WHERE provider_message_id = ${providerMessageId}`
  )
}

export async function findActiveSupportTicketForPhone(
  phoneE164: string
): Promise<SmsSupportTicket | null> {
  return db.one(
    sql`SELECT ${selectAll(smsSupportTickets)} FROM sms_support_tickets WHERE phone_e164 = ${phoneE164} AND status = ANY(${array(ACTIVE_TICKET_STATUSES)}) ORDER BY updated_at DESC LIMIT 1`
  )
}

export async function findActiveSupportTicketSummaryForPhone(
  phoneE164: string
): Promise<Pick<SmsSupportTicket, 'id' | 'status' | 'submissionId'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportTickets, ['id', 'status', 'submissionId'])} FROM sms_support_tickets WHERE phone_e164 = ${phoneE164} AND status = ANY(${array(ACTIVE_TICKET_STATUSES)}) ORDER BY updated_at DESC LIMIT 1`
  )
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
  const [ticket] = await db.rows(
    sql`${insert(smsSupportTickets, {
      phoneE164,
      submissionId,
      status: SMS_SUPPORT_STATUS.OPEN,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      source: SMS_SUPPORT_SOURCE.INBOUND_SMS,
      lastInboundAt,
    })} RETURNING ${selectAll(smsSupportTickets)}`
  )
  return ticket
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
  const [ticket] = await db.rows(
    sql`${insert(smsSupportTickets, {
      phoneE164,
      submissionId,
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      category: SMS_SUPPORT_CATEGORY.OTHER,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      source: SMS_SUPPORT_SOURCE.ADMIN_CREATED,
      adminSummary,
    })} RETURNING ${select(smsSupportTickets, ['id'])}`
  )
  return ticket
}

export async function recordSupportTicketInbound(
  ticketId: string,
  { matchedSubmissionId, lastInboundAt }: { matchedSubmissionId?: string; lastInboundAt: Date }
): Promise<SmsSupportTicket> {
  return updateTicket(ticketId, {
    submissionId: matchedSubmissionId,
    lastInboundAt,
    closedAt: null,
  })
}

export async function updateSupportTicketConversation(
  ticketId: string,
  update: SupportTicketConversationUpdate
): Promise<SmsSupportTicket> {
  return updateTicket(ticketId, update)
}

export async function escalateSupportTicketToCsr(
  ticketId: string,
  {
    category,
    adminSummary,
    collectedData,
  }: { category: string | null; adminSummary: string; collectedData: JsonObject }
): Promise<SmsSupportTicket> {
  return updateTicket(ticketId, {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    category,
    adminSummary,
    collectedData,
  })
}

export async function markSupportTicketReplyFailed(
  ticketId: string,
  failureReason: string
): Promise<SmsSupportTicket> {
  return updateTicket(ticketId, {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    failureReason,
    adminSummary: 'Support SMS failed to send. Admin should contact the customer manually.',
    closedAt: null,
  })
}

export async function assignSupportTicketSubmission(
  ticketId: string,
  submissionId: string
): Promise<void> {
  await updateTicket(ticketId, { submissionId })
}

async function listSupportTickets(where: Sql, limit: number): Promise<SupportTicketListItem[]> {
  const tickets = await db.rows(
    sql`SELECT ${ticketWithSubmission(listSubmissionKeys)} WHERE ${where} ORDER BY t.updated_at DESC LIMIT ${limit}`
  )
  const ids = tickets.map((ticket) => ticket.id)
  const [messages, jobs] = await Promise.all([
    db.rows(
      sql`SELECT DISTINCT ON (support_ticket_id) ${select(smsMessages, ['supportTicketId', ...listMessageKeys])} FROM sms_messages WHERE support_ticket_id = ANY(${array(ids)}) ORDER BY support_ticket_id, created_at DESC`
    ),
    db.rows(
      sql`SELECT DISTINCT ON (ticket_id) ${select(smsSupportJobs, ['ticketId', ...listJobKeys])} FROM sms_support_jobs WHERE ticket_id = ANY(${array(ids)}) ORDER BY ticket_id, created_at DESC`
    ),
  ])
  const messagesByTicket = groupBy(messages, 'supportTicketId')
  const jobsByTicket = groupBy(jobs, 'ticketId')
  return tickets.map((ticket) => ({
    ...nest(ticket, 'submission', true),
    messages: messagesByTicket.get(ticket.id) ?? [],
    jobs: jobsByTicket.get(ticket.id) ?? [],
  }))
}

export async function findSupportTicketsWithStatus(
  status: string
): Promise<SupportTicketListItem[]> {
  return listSupportTickets(sql`t.status = ${status}`, 200)
}

export async function findActiveSupportTicketsForQueue(): Promise<SupportTicketListItem[]> {
  return listSupportTickets(sql`t.status = ANY(${array(ACTIVE_TICKET_STATUSES)})`, 200)
}

export async function findClosedSupportTicketsForQueue(
  take: number
): Promise<SupportTicketListItem[]> {
  return listSupportTickets(sql`t.status = ${SMS_SUPPORT_STATUS.CLOSED}`, take)
}

export async function findSupportTicketDetail(
  ticketId: string
): Promise<SupportTicketDetail | null> {
  const ticket = await db.one(
    sql`SELECT ${ticketWithSubmission(detailSubmissionKeys)} WHERE t.id = ${ticketId}`
  )
  if (!ticket) return null
  const [messages, jobs] = await Promise.all([
    db.rows(
      sql`SELECT ${select(smsMessages, detailMessageKeys)} FROM sms_messages WHERE support_ticket_id = ${ticketId} ORDER BY created_at ASC`
    ),
    db.rows(
      sql`SELECT ${select(smsSupportJobs, detailJobKeys)} FROM sms_support_jobs WHERE ticket_id = ${ticketId} ORDER BY created_at DESC`
    ),
  ])
  return { ...nest(ticket, 'submission', true), messages, jobs }
}

export async function findSupportTicketContact(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'id' | 'phoneE164' | 'submissionId'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportTickets, ['id', 'phoneE164', 'submissionId'])} FROM sms_support_tickets WHERE id = ${ticketId}`
  )
}

export async function findSupportTicketLastOutboundAt(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'lastOutboundAt'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportTickets, ['lastOutboundAt'])} FROM sms_support_tickets WHERE id = ${ticketId}`
  )
}

export async function recordSupportTicketOutbound(ticketId: string): Promise<void> {
  await db.affected(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, { lastOutboundAt: new Date() })} WHERE id = ${ticketId}`
  )
}

export async function findSupportTicketCsrAlert(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'csrAlertedAt'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportTickets, ['csrAlertedAt'])} FROM sms_support_tickets WHERE id = ${ticketId}`
  )
}

export async function markSupportTicketCsrAlerted(ticketId: string): Promise<void> {
  await db.affected(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, { csrAlertedAt: new Date() })} WHERE id = ${ticketId} AND csr_alerted_at IS NULL`
  )
}

export async function markSupportTicketAdminReplied(ticketId: string): Promise<void> {
  await updateTicket(ticketId, {
    status: SMS_SUPPORT_STATUS.OPEN,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    adminSummary: 'Admin replied by SMS.',
    csrAlertedAt: null,
  })
}

export async function markSupportTicketAdminReplyFailed(
  ticketId: string,
  failureReason: string
): Promise<void> {
  await updateTicket(ticketId, {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    adminSummary: 'Admin reply failed to send by SMS.',
    failureReason,
  })
}

export async function closeSupportTicketByAdmin(
  ticketId: string,
  closedAt: Date
): Promise<Pick<SmsSupportTicket, 'submissionId'>> {
  const { submissionId } = await updateTicket(ticketId, {
    status: SMS_SUPPORT_STATUS.CLOSED,
    state: SMS_SUPPORT_STATE.CLOSED,
    closedAt,
  })
  return { submissionId }
}

export async function returnSupportTicketToCsrReview(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'submissionId'>> {
  const { submissionId } = await updateTicket(ticketId, {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    closedAt: null,
  })
  return { submissionId }
}

export async function findSupportTicketForAutomationRetry(
  ticketId: string
): Promise<Pick<
  SmsSupportTicket,
  'id' | 'automationKind' | 'automationStatus' | 'collectedData' | 'status'
> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportTickets, ['id', 'automationKind', 'automationStatus', 'collectedData', 'status'])} FROM sms_support_tickets WHERE id = ${ticketId}`
  )
}

export async function startSupportAutomationRetry(
  ticketId: string,
  retrySummary: string | null
): Promise<void> {
  await updateTicket(ticketId, {
    status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    adminSummary: retrySummary ? `Retry started: ${retrySummary}` : 'Retry started.',
    failureReason: null,
    retryCount: sql`retry_count + 1`,
  })
}

export async function escalateSupportTicketAfterAutomationFailure(
  ticketId: string,
  failureReason: string
): Promise<SmsSupportTicket> {
  return updateTicket(ticketId, {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: 'CSR_REVIEW',
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
    failureReason,
  })
}

export async function claimSupportTicketAutomationRun(ticketId: string): Promise<number> {
  return db.affected(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, {
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
      failureReason: null,
    })} WHERE id = ${ticketId} AND status = ${SMS_SUPPORT_STATUS.RUNNING_AUTOMATION} AND automation_status = ANY(${array(ACTIVE_AUTOMATION_STATUSES)})`
  )
}

export async function closeSupportTicketAfterAutomation(
  ticketId: string,
  adminSummary: string
): Promise<void> {
  await db.affected(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, {
      status: SMS_SUPPORT_STATUS.CLOSED,
      state: 'CLOSED',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED,
      adminSummary,
      failureReason: null,
      closedAt: new Date(),
    })} WHERE id = ${ticketId} AND status = ${SMS_SUPPORT_STATUS.RUNNING_AUTOMATION}`
  )
}

export async function createSupportAutomationJob({
  ticketId,
  payload,
}: {
  ticketId: string
  payload: JsonObject
}): Promise<SmsSupportJob | null> {
  return db.one(
    sql`${insert(smsSupportJobs, {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload,
    })} ON CONFLICT DO NOTHING RETURNING ${selectAll(smsSupportJobs)}`
  )
}

export async function createRetrySupportAutomationJob({
  ticketId,
  payload,
}: {
  ticketId: string
  payload: JsonValue | null
}): Promise<SmsSupportJob> {
  const [job] = await db.rows(
    sql`${insert(smsSupportJobs, {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload,
    })} RETURNING ${selectAll(smsSupportJobs)}`
  )
  return job
}

export async function findActiveSupportAutomationJob(
  ticketId: string
): Promise<SmsSupportJob | null> {
  return db.one(
    sql`SELECT ${selectAll(smsSupportJobs)} FROM sms_support_jobs WHERE ticket_id = ${ticketId} AND kind = ${SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION} AND status = ANY(${array(ACTIVE_JOB_STATUSES)}) ORDER BY created_at DESC LIMIT 1`
  )
}

export async function findActiveSupportAutomationJobId(
  ticketId: string
): Promise<Pick<SmsSupportJob, 'id'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportJobs, ['id'])} FROM sms_support_jobs WHERE ticket_id = ${ticketId} AND kind = ${SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION} AND status = ANY(${array(ACTIVE_JOB_STATUSES)}) LIMIT 1`
  )
}

export async function findLatestSupportAutomationJob(
  ticketId: string
): Promise<SmsSupportJob | null> {
  return db.one(
    sql`SELECT ${selectAll(smsSupportJobs)} FROM sms_support_jobs WHERE ticket_id = ${ticketId} AND kind = ${SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION} ORDER BY created_at DESC LIMIT 1`
  )
}

export async function findRunnableQueuedSupportJob(
  jobId: string
): Promise<Pick<SmsSupportJob, 'id' | 'ticketId'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportJobs, ['id', 'ticketId'], { alias: 'j' })} FROM sms_support_jobs j JOIN sms_support_tickets t ON t.id = j.ticket_id WHERE j.id = ${jobId} AND ${runnableJob()} LIMIT 1`
  )
}

export async function findRunnableQueuedSupportJobs(limit: number): Promise<SmsSupportJob[]> {
  return db.rows(
    sql`SELECT ${selectAll(smsSupportJobs, { alias: 'j' })} FROM sms_support_jobs j JOIN sms_support_tickets t ON t.id = j.ticket_id WHERE ${runnableJob()} ORDER BY j.created_at ASC LIMIT ${limit}`
  )
}

export async function requeueStaleRunningSupportJobs(staleBefore: Date): Promise<void> {
  await db.affected(
    sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, {
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      lockedAt: null,
      lockedBy: null,
      lastError: 'Recovered stale running job lock',
      runAfter: new Date(),
    })} WHERE status = ${SMS_SUPPORT_JOB_STATUS.RUNNING} AND locked_at < ${staleBefore}`
  )
}

export async function findStaleCommittingSupportJobs(
  staleBefore: Date,
  limit: number
): Promise<SmsSupportJobWithTicket[]> {
  const rows = await db.rows(
    sql`SELECT ${jobWithTicket} WHERE j.status = ${SMS_SUPPORT_JOB_STATUS.COMMITTING} AND j.locked_at < ${staleBefore} LIMIT ${limit}`
  )
  return rows.map((row) => nest(row, 'ticket'))
}

export async function failStaleCommittingSupportJob(
  jobId: string,
  { staleBefore, lastError }: { staleBefore: Date; lastError: string }
): Promise<number> {
  return db.affected(
    sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, {
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError,
      completedAt: new Date(),
    })} WHERE id = ${jobId} AND status = ${SMS_SUPPORT_JOB_STATUS.COMMITTING} AND locked_at < ${staleBefore}`
  )
}

export async function claimQueuedSupportJob(jobId: string, workerId: string): Promise<number> {
  return db.affected(
    sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, {
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: sql`attempts + 1`,
    })} WHERE id = ${jobId} AND status = ${SMS_SUPPORT_JOB_STATUS.QUEUED}`
  )
}

export async function completeSupportJob(jobId: string): Promise<void> {
  await updateJob(jobId, {
    status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
    completedAt: new Date(),
    lockedAt: null,
    lockedBy: null,
    lastError: null,
  })
}

export async function failSupportJob(jobId: string, lastError: string): Promise<void> {
  await updateJob(jobId, {
    status: SMS_SUPPORT_JOB_STATUS.FAILED,
    lockedAt: null,
    lockedBy: null,
    lastError,
    completedAt: new Date(),
  })
}

export async function failQueuedOrRunningSupportJobs(
  ticketId: string,
  { lastError, completedAt }: { lastError: string; completedAt: Date }
): Promise<void> {
  await db.affected(
    sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, {
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError,
      completedAt,
    })} WHERE ticket_id = ${ticketId} AND status = ANY(${array([SMS_SUPPORT_JOB_STATUS.QUEUED, SMS_SUPPORT_JOB_STATUS.RUNNING])})`
  )
}

export async function findCommittingSupportJob(
  ticketId: string
): Promise<Pick<SmsSupportJob, 'id'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportJobs, ['id'])} FROM sms_support_jobs WHERE ticket_id = ${ticketId} AND status = ${SMS_SUPPORT_JOB_STATUS.COMMITTING} LIMIT 1`
  )
}

export async function findSupportJobWithTicket(
  jobId: string
): Promise<SmsSupportJobWithTicket | null> {
  const row = await db.one(sql`SELECT ${jobWithTicket} WHERE j.id = ${jobId}`)
  return row && nest(row, 'ticket')
}

export async function findSupportJobStatus(
  jobId: string
): Promise<Pick<SmsSupportJob, 'status'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportJobs, ['status'])} FROM sms_support_jobs WHERE id = ${jobId}`
  )
}

export async function findSupportTicketIdsByStatus(
  status: SmsSupportTicket['status'],
  take: number
): Promise<Pick<SmsSupportTicket, 'id'>[]> {
  return db.rows(
    sql`SELECT ${select(smsSupportTickets, ['id'])} FROM sms_support_tickets WHERE status = ${status} LIMIT ${take}`
  )
}
