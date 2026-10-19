import { db, type Db } from './pool'
import { and, array, sql, type Sql } from './sql'
import { insert, select, selectAll, set, type Patch } from './table'
import { smsSupportJobs, smsSupportTickets } from './tables'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
  type SmsSupportAutomationKind,
  type SmsSupportAutomationStatus,
  type SmsSupportCategory,
  type SmsSupportJobStatus,
  type SmsSupportState,
  type SmsSupportStatus,
} from '@/lib/sms-support-types'
import type { JsonObject, JsonValue, SmsSupportJob, SmsSupportTicket } from './types'

const EVERY_TICKET_STATUS: readonly SmsSupportStatus[] = Object.values(SMS_SUPPORT_STATUS)

const CONVERSING = [
  SMS_SUPPORT_STATUS.OPEN,
  SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
  SMS_SUPPORT_STATUS.NEEDS_CSR,
] as const

export const ACTIVE_AUTOMATION_STATUSES = [
  SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
  SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
] as const

const EVERY_JOB_STATUS: readonly SmsSupportJobStatus[] = Object.values(SMS_SUPPORT_JOB_STATUS)

type Stamped = { readonly at: Date }

export type Prompt = Stamped & {
  readonly state: SmsSupportState
  readonly category?: SmsSupportCategory | null
  readonly collectedData?: JsonObject
  readonly submissionId?: string
  readonly failureReason?: null
}
export type Escalation = Stamped & {
  readonly category: SmsSupportCategory | null
  readonly adminSummary: string
  readonly collectedData: JsonObject
}
export type AutomationRequest = Stamped & {
  readonly category: SmsSupportCategory
  readonly automationKind: SmsSupportAutomationKind
  readonly adminSummary: string
  readonly collectedData: JsonObject
}
export type Failure = Stamped & { readonly failureReason: string }
export type Summary = Stamped & { readonly adminSummary: string }
export type Retry = Stamped & { readonly summary: string | null }
export type Claim = Stamped & { readonly workerId: string }
export type JobFailure = Stamped & { readonly lastError: string }

type TicketWritten = Omit<
  SmsSupportTicket,
  'id' | 'phoneE164' | 'source' | 'lastInboundAt' | 'lastOutboundAt' | 'createdAt' | 'updatedAt'
>

type JobWritten = Omit<
  SmsSupportJob,
  'id' | 'ticketId' | 'kind' | 'payload' | 'createdAt' | 'updatedAt'
>

type Rule<S extends string, I extends Stamped, W> = {
  readonly from: readonly S[]
  readonly automation?: readonly SmsSupportAutomationStatus[]
  readonly write: (input: I) => Patch<W>
}

function prompted(input: Prompt): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
    state: input.state,
    category: input.category,
    collectedData: input.collectedData,
    submissionId: input.submissionId,
    failureReason: input.failureReason,
  }
}

function closedByCustomer(input: Stamped): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.CLOSED,
    state: SMS_SUPPORT_STATE.CLOSED,
    category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
    adminSummary: 'Customer found the note after checking spam/junk.',
    closedAt: input.at,
  }
}

function automationQueued(input: AutomationRequest): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    category: input.category,
    automationKind: input.automationKind,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    adminSummary: input.adminSummary,
    failureReason: null,
    collectedData: input.collectedData,
  }
}

function escalated(input: Escalation): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    category: input.category,
    adminSummary: input.adminSummary,
    collectedData: input.collectedData,
  }
}

function replyFailure(input: Failure): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    failureReason: input.failureReason,
    adminSummary: 'Support SMS failed to send. Admin should contact the customer manually.',
    closedAt: null,
  }
}

function adminReply(_input: Stamped): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.OPEN,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    adminSummary: 'Admin replied by SMS.',
    csrAlertedAt: null,
  }
}

function adminReplyFailure(input: Failure): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    adminSummary: 'Admin reply failed to send by SMS.',
    failureReason: input.failureReason,
  }
}

function closedByAdmin(input: Stamped): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.CLOSED,
    state: SMS_SUPPORT_STATE.CLOSED,
    closedAt: input.at,
  }
}

function returnedToCsr(_input: Stamped): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    closedAt: null,
  }
}

function retried(input: Retry): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    adminSummary: input.summary ? `Retry started: ${input.summary}` : 'Retry started.',
    failureReason: null,
    retryCount: sql`retry_count + 1`,
  }
}

function automationFailure(input: Failure): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.NEEDS_CSR,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
    failureReason: input.failureReason,
  }
}

function automationClaimed(_input: Stamped): Patch<TicketWritten> {
  return {
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
    failureReason: null,
  }
}

function automationCommitted(_input: Stamped): Patch<TicketWritten> {
  return { failureReason: null }
}

function automationSuccess(input: Summary): Patch<TicketWritten> {
  return {
    status: SMS_SUPPORT_STATUS.CLOSED,
    state: SMS_SUPPORT_STATE.CLOSED,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED,
    adminSummary: input.adminSummary,
    failureReason: null,
    closedAt: input.at,
  }
}

const tickets = {
  prompt: { from: CONVERSING, write: prompted },
  closeFound: { from: CONVERSING, write: closedByCustomer },
  queueAutomation: { from: CONVERSING, write: automationQueued },
  escalate: { from: CONVERSING, write: escalated },
  replyFailed: { from: EVERY_TICKET_STATUS, write: replyFailure },
  adminReplied: { from: EVERY_TICKET_STATUS, write: adminReply },
  adminReplyFailed: { from: EVERY_TICKET_STATUS, write: adminReplyFailure },
  closeByAdmin: { from: EVERY_TICKET_STATUS, write: closedByAdmin },
  returnToCsr: { from: EVERY_TICKET_STATUS, write: returnedToCsr },
  retryAutomation: {
    from: [SMS_SUPPORT_STATUS.NEEDS_CSR],
    automation: [SMS_SUPPORT_AUTOMATION_STATUS.FAILED],
    write: retried,
  },
  automationFailed: { from: EVERY_TICKET_STATUS, write: automationFailure },
  claimAutomation: {
    from: [SMS_SUPPORT_STATUS.RUNNING_AUTOMATION],
    automation: ACTIVE_AUTOMATION_STATUSES,
    write: automationClaimed,
  },
  commitAutomation: {
    from: [SMS_SUPPORT_STATUS.RUNNING_AUTOMATION],
    automation: [SMS_SUPPORT_AUTOMATION_STATUS.RUNNING],
    write: automationCommitted,
  },
  automationSucceeded: {
    from: [SMS_SUPPORT_STATUS.RUNNING_AUTOMATION],
    write: automationSuccess,
  },
} as const

export type TicketTransition = keyof typeof tickets
type TicketInputs = { [K in TicketTransition]: Parameters<(typeof tickets)[K]['write']>[0] }
export type TicketInput<K extends TicketTransition> = TicketInputs[K]
const ticketRules: {
  [K in TicketTransition]: Rule<SmsSupportStatus, TicketInputs[K], TicketWritten>
} = tickets

function claimed(input: Claim): Patch<JobWritten> {
  return {
    status: SMS_SUPPORT_JOB_STATUS.RUNNING,
    lockedAt: input.at,
    lockedBy: input.workerId,
    attempts: sql`attempts + 1`,
  }
}

function committed(input: Stamped): Patch<JobWritten> {
  return { status: SMS_SUPPORT_JOB_STATUS.COMMITTING, lockedAt: input.at }
}

function completed(input: Stamped): Patch<JobWritten> {
  return {
    status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
    completedAt: input.at,
    lockedAt: null,
    lockedBy: null,
    lastError: null,
  }
}

function failed(input: JobFailure): Patch<JobWritten> {
  return {
    status: SMS_SUPPORT_JOB_STATUS.FAILED,
    lockedAt: null,
    lockedBy: null,
    lastError: input.lastError,
    completedAt: input.at,
  }
}

function requeued(input: Stamped): Patch<JobWritten> {
  return {
    status: SMS_SUPPORT_JOB_STATUS.QUEUED,
    lockedAt: null,
    lockedBy: null,
    lastError: 'Recovered stale running job lock',
    runAfter: input.at,
  }
}

const jobs = {
  claim: { from: [SMS_SUPPORT_JOB_STATUS.QUEUED], write: claimed },
  commit: { from: [SMS_SUPPORT_JOB_STATUS.RUNNING], write: committed },
  complete: { from: EVERY_JOB_STATUS, write: completed },
  fail: { from: EVERY_JOB_STATUS, write: failed },
  failStale: { from: [SMS_SUPPORT_JOB_STATUS.COMMITTING], write: failed },
  cancel: { from: [SMS_SUPPORT_JOB_STATUS.QUEUED, SMS_SUPPORT_JOB_STATUS.RUNNING], write: failed },
  requeueStale: { from: [SMS_SUPPORT_JOB_STATUS.RUNNING], write: requeued },
} as const

export type JobTransition = keyof typeof jobs
type JobInputs = { [K in JobTransition]: Parameters<(typeof jobs)[K]['write']>[0] }
export type JobInput<K extends JobTransition> = JobInputs[K]
const jobRules: { [K in JobTransition]: Rule<SmsSupportJobStatus, JobInputs[K], JobWritten> } = jobs

export type TicketRefusal =
  | { readonly reason: 'missing' }
  | { readonly reason: 'status'; readonly status: SmsSupportStatus }
  | {
      readonly reason: 'automation'
      readonly automationStatus: SmsSupportAutomationStatus | null
    }
  | { readonly reason: 'stale' }

export type JobRefusal =
  | { readonly reason: 'missing' }
  | { readonly reason: 'status'; readonly status: SmsSupportJobStatus }
  | { readonly reason: 'stale' }

export type Outcome<V, R> =
  | { readonly ok: true; readonly value: V }
  | { readonly ok: false; readonly refusal: R }

function refuse<R>(refusal: R): { ok: false; refusal: R } {
  return { ok: false, refusal }
}

function describeRefusal(refusal: TicketRefusal | JobRefusal): string {
  switch (refusal.reason) {
    case 'missing':
      return 'the row was not found'
    case 'status':
      return `the status is ${refusal.status}`
    case 'automation':
      return `the automation status is ${refusal.automationStatus ?? 'none'}`
    case 'stale':
      return 'the row changed while the write ran'
  }
}

export function required<V>(outcome: Outcome<V, TicketRefusal | JobRefusal>, subject: string): V {
  if (outcome.ok) return outcome.value
  throw new Error(`${subject} was refused: ${describeRefusal(outcome.refusal)}`)
}

type Guarded = Pick<SmsSupportTicket, 'status' | 'automationStatus'>

function ticketMismatch(
  rule: Pick<Rule<SmsSupportStatus, Stamped, TicketWritten>, 'from' | 'automation'>,
  row: Guarded
): Exclude<TicketRefusal, { reason: 'missing' | 'stale' }> | null {
  if (!rule.from.includes(row.status)) return { reason: 'status', status: row.status }
  if (
    rule.automation &&
    (row.automationStatus === null || !rule.automation.includes(row.automationStatus))
  ) {
    return { reason: 'automation', automationStatus: row.automationStatus }
  }
  return null
}

function admitting(rule: { from: readonly string[]; automation?: readonly string[] }): Sql {
  return and(
    sql`status = ANY(${array(rule.from)})`,
    rule.automation && sql`automation_status = ANY(${array(rule.automation)})`
  )
}

async function readTicket(ticketId: string, on: Db): Promise<SmsSupportTicket | null> {
  return on.one(
    sql`SELECT ${selectAll(smsSupportTickets)} FROM sms_support_tickets WHERE id = ${ticketId}`
  )
}

export async function permit(
  ticketId: string,
  name: TicketTransition
): Promise<Outcome<SmsSupportTicket, TicketRefusal>> {
  const row = await readTicket(ticketId, db)
  if (!row) return refuse({ reason: 'missing' })
  const problem = ticketMismatch(ticketRules[name], row)
  return problem ? refuse(problem) : { ok: true, value: row }
}

export async function transition<K extends TicketTransition>(
  name: K,
  ticketId: string,
  input: TicketInputs[K],
  on: Db = db
): Promise<Outcome<SmsSupportTicket, TicketRefusal>> {
  const rule = ticketRules[name]
  const row = await on.one(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, { ...rule.write(input), updatedAt: input.at })} WHERE ${and(sql`id = ${ticketId}`, admitting(rule))} RETURNING ${selectAll(smsSupportTickets)}`
  )
  if (row) return { ok: true, value: row }
  const live = await on.one(
    sql`SELECT ${select(smsSupportTickets, ['status', 'automationStatus'])} FROM sms_support_tickets WHERE id = ${ticketId}`
  )
  if (!live) return refuse({ reason: 'missing' })
  return refuse(ticketMismatch(rule, live) ?? { reason: 'stale' })
}

export async function transitionJob<K extends JobTransition>(
  name: K,
  jobId: string,
  input: JobInputs[K],
  on: Db = db
): Promise<Outcome<SmsSupportJob, JobRefusal>> {
  const rule = jobRules[name]
  const row = await on.one(
    sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, { ...rule.write(input), updatedAt: input.at })} WHERE ${and(sql`id = ${jobId}`, admitting(rule))} RETURNING ${selectAll(smsSupportJobs)}`
  )
  if (row) return { ok: true, value: row }
  const live = await on.one(
    sql`SELECT ${select(smsSupportJobs, ['status'])} FROM sms_support_jobs WHERE id = ${jobId}`
  )
  if (!live) return refuse({ reason: 'missing' })
  if (!rule.from.includes(live.status)) return refuse({ reason: 'status', status: live.status })
  return refuse({ reason: 'stale' })
}

async function transitionJobs<K extends JobTransition>(
  name: K,
  scope: Sql,
  input: JobInputs[K]
): Promise<number> {
  const rule = jobRules[name]
  return db.affected(
    sql`UPDATE sms_support_jobs SET ${set(smsSupportJobs, { ...rule.write(input), updatedAt: input.at })} WHERE ${and(scope, admitting(rule))}`
  )
}

export function cancelSupportJobs(ticketId: string, input: JobFailure): Promise<number> {
  return transitionJobs('cancel', sql`ticket_id = ${ticketId}`, input)
}

export function requeueStaleSupportJobs(staleBefore: Date, input: Stamped): Promise<number> {
  return transitionJobs('requeueStale', sql`locked_at < ${staleBefore}`, input)
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
}): Promise<SmsSupportTicket> {
  const [ticket] = await db.rows(
    sql`${insert(smsSupportTickets, {
      phoneE164,
      submissionId,
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      category: SMS_SUPPORT_CATEGORY.OTHER,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      source: SMS_SUPPORT_SOURCE.ADMIN_CREATED,
      adminSummary,
    })} RETURNING ${selectAll(smsSupportTickets)}`
  )
  return ticket
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
