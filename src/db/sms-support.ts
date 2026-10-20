import { db } from './pool'
import { array, sql, type Sql } from './sql'
import { insert, select, selectAll, set, type Patch } from './table'
import {
  smsMessages,
  smsPhoneStates,
  smsSupportJobs,
  smsSupportTicketDetails,
  smsSupportTickets,
  submissions,
} from './tables'
import {
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { ACTIVE_AUTOMATION_STATUSES } from './sms-support-lifecycle'
import type {
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

const jobWithTicket = sql`${selectAll(smsSupportJobs, { alias: 'j' })}, ${selectAll(smsSupportTickets, { alias: 't', prefix: JOINED })}
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

export async function recordSupportTicketInbound(
  ticketId: string,
  { matchedSubmissionId, lastInboundAt }: { matchedSubmissionId?: string; lastInboundAt: Date }
): Promise<SmsSupportTicket> {
  const ticket = await db.one(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { submissionId: matchedSubmissionId, lastInboundAt })} WHERE id = ${ticketId} RETURNING ${selectAll(smsSupportTickets)}`
  )
  if (!ticket) throw new Error(`Support ticket ${ticketId} not found`)
  return ticket
}

export async function assignSupportTicketSubmission(
  ticketId: string,
  submissionId: string
): Promise<void> {
  const updated = await db.affected(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { submissionId })} WHERE id = ${ticketId}`
  )
  if (updated === 0) throw new Error(`Support ticket ${ticketId} not found`)
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

export async function findSupportTicketLastOutboundAt(
  ticketId: string
): Promise<Pick<SmsSupportTicket, 'lastOutboundAt'> | null> {
  return db.one(
    sql`SELECT ${select(smsSupportTickets, ['lastOutboundAt'])} FROM sms_support_tickets WHERE id = ${ticketId}`
  )
}

export async function recordSupportTicketOutbound(ticketId: string): Promise<void> {
  await db.affected(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { lastOutboundAt: new Date() })} WHERE id = ${ticketId}`
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
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTicketDetails, { csrAlertedAt: new Date() })} WHERE id = ${ticketId} AND csr_alerted_at IS NULL`
  )
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
