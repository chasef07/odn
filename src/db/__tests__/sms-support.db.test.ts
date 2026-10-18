import { describe, expect, it } from 'vitest'
import {
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
} from '@/lib/sms-support-types'
import { db } from '../pool'
import { count, sql } from '../sql'
import { insert, selectAll, set, type Patch } from '../table'
import { smsMessages, smsSupportJobs, smsSupportTickets, submissions } from '../tables'
import type { SmsMessage, SmsSupportJob, SmsSupportTicket, Submission } from '../types'
import {
  assignSupportTicketSubmission,
  claimQueuedSupportJob,
  claimSupportTicketAutomationRun,
  closeSupportTicketAfterAutomation,
  closeSupportTicketByAdmin,
  completeSupportJob,
  createAdminSupportTicket,
  createInboundSupportTicket,
  createOutboundSmsMessage,
  createRetrySupportAutomationJob,
  createSupportAutomationJob,
  escalateSupportTicketAfterAutomationFailure,
  escalateSupportTicketToCsr,
  failQueuedOrRunningSupportJobs,
  failStaleCommittingSupportJob,
  failSupportJob,
  findActiveSupportAutomationJob,
  findActiveSupportAutomationJobId,
  findActiveSupportTicketForPhone,
  findActiveSupportTicketsForQueue,
  findActiveSupportTicketSummaryForPhone,
  findClosedSupportTicketsForQueue,
  findCommittingSupportJob,
  findLatestSupportAutomationJob,
  findRunnableQueuedSupportJob,
  findRunnableQueuedSupportJobs,
  findSmsMessageSupportHandledAt,
  findSmsPhoneConsentState,
  findSmsPhoneOptOut,
  findStaleCommittingSupportJobs,
  findSupportJobStatus,
  findSupportJobWithTicket,
  findSupportTicketContact,
  findSupportTicketCsrAlert,
  findSupportTicketDetail,
  findSupportTicketForAutomationRetry,
  findSupportTicketIdsByStatus,
  findSupportTicketLastOutboundAt,
  findSupportTicketsWithStatus,
  linkSmsMessageToSupportTicket,
  markSmsMessageSupportHandled,
  markSupportTicketAdminReplied,
  markSupportTicketAdminReplyFailed,
  markSupportTicketCsrAlerted,
  markSupportTicketReplyFailed,
  recordSmsMessageAccepted,
  recordSmsMessageFinalized,
  recordSmsMessageProviderRejection,
  recordSmsMessageSendError,
  recordSmsMessageSent,
  recordSmsPhoneOptIn,
  recordSmsPhoneOptOut,
  recordSupportTicketInbound,
  recordSupportTicketOutbound,
  requeueStaleRunningSupportJobs,
  returnSupportTicketToCsrReview,
  startSupportAutomationRetry,
  updateSupportTicketConversation,
  upsertInboundSmsMessage,
} from '../sms-support'

const PHONE = '+15551234567'
const OTHER_PHONE = '+15550000000'
const UNKNOWN_PHONE = '+15559999999'
const SUPPORT_NUMBER = '+18885551212'
const T0 = new Date('2026-06-16T12:00:00.000Z')
const T1 = new Date('2026-06-16T12:05:00.000Z')
const T2 = new Date('2026-06-16T12:10:00.000Z')
const T3 = new Date('2026-06-16T12:15:00.000Z')
const DOB = new Date('1990-01-01T00:00:00.000Z')
const DAY_OFF = new Date('2026-06-10T00:00:00.000Z')
const dobPayload = {
  kind: 'UPDATE_DOB_REISSUE_NOTE',
  category: 'CHANGE_DOB',
  updates: { patientDateOfBirth: '1990-01-01' },
}

function pick<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, row[key]])) as Pick<T, K>
}

async function seedSubmission(patch: Patch<Submission> = {}): Promise<Submission> {
  const [row] = await db.rows(
    sql`${insert(submissions, {
      stripePaymentIntentId: `pi_${Math.random()}`,
      state: 'CA',
      recipient: 'work',
      patientFirstName: 'Ada',
      patientLastName: 'Lovelace',
      patientDateOfBirth: DOB,
      email: 'ada@example.com',
      phone: '5551234567',
      notePurpose: 'work',
      firstDayOff: DAY_OFF,
      lastDayOff: DAY_OFF,
      absenceReason: 'illness',
      ...patch,
    })} RETURNING ${selectAll(submissions)}`
  )
  return row
}

async function seedTicket(patch: Patch<SmsSupportTicket> = {}): Promise<SmsSupportTicket> {
  const [row] = await db.rows(
    sql`${insert(smsSupportTickets, {
      phoneE164: PHONE,
      status: SMS_SUPPORT_STATUS.OPEN,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      source: SMS_SUPPORT_SOURCE.INBOUND_SMS,
      ...patch,
    })} RETURNING ${selectAll(smsSupportTickets)}`
  )
  return row
}

async function seedJob(ticketId: string, patch: Patch<SmsSupportJob> = {}): Promise<SmsSupportJob> {
  const [row] = await db.rows(
    sql`${insert(smsSupportJobs, {
      ticketId,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: dobPayload,
      ...patch,
    })} RETURNING ${selectAll(smsSupportJobs)}`
  )
  return row
}

async function seedMessage(patch: Patch<SmsMessage> = {}): Promise<SmsMessage> {
  const [row] = await db.rows(
    sql`${insert(smsMessages, {
      type: 'INBOUND',
      direction: 'inbound',
      to: SUPPORT_NUMBER,
      from: PHONE,
      body: 'HELP',
      ...patch,
    })} RETURNING ${selectAll(smsMessages)}`
  )
  return row
}

async function readTicket(id: string): Promise<SmsSupportTicket | null> {
  return db.one(
    sql`SELECT ${selectAll(smsSupportTickets)} FROM sms_support_tickets WHERE id = ${id}`
  )
}

async function readJob(id: string): Promise<SmsSupportJob | null> {
  return db.one(sql`SELECT ${selectAll(smsSupportJobs)} FROM sms_support_jobs WHERE id = ${id}`)
}

async function readMessage(id: string): Promise<SmsMessage | null> {
  return db.one(sql`SELECT ${selectAll(smsMessages)} FROM sms_messages WHERE id = ${id}`)
}

async function allMessages(): Promise<SmsMessage[]> {
  return db.rows(sql`SELECT ${selectAll(smsMessages)} FROM sms_messages`)
}

async function touch(ticketId: string, updatedAt: Date): Promise<void> {
  await db.affected(
    sql`UPDATE sms_support_tickets SET ${set(smsSupportTickets, { updatedAt })} WHERE id = ${ticketId}`
  )
}

describe('phone opt-out and opt-in state', () => {
  it('returns null for a phone with no state', async () => {
    expect(await findSmsPhoneOptOut(PHONE)).toBeNull()
    expect(await findSmsPhoneConsentState(PHONE)).toBeNull()
  })

  it('records an opt-out, then an opt-in clears it, then an opt-out keeps the opt-in time', async () => {
    await recordSmsPhoneOptOut(PHONE, T0)
    expect(await findSmsPhoneOptOut(PHONE)).toEqual({ optedOutAt: T0 })

    await recordSmsPhoneOptOut(PHONE, T1)
    expect(await findSmsPhoneConsentState(PHONE)).toEqual({ optedOutAt: T1, lastOptInAt: null })

    await recordSmsPhoneOptIn(PHONE, T2)
    expect(await findSmsPhoneConsentState(PHONE)).toEqual({ optedOutAt: null, lastOptInAt: T2 })

    await recordSmsPhoneOptOut(PHONE, T3)
    expect(await findSmsPhoneConsentState(PHONE)).toEqual({ optedOutAt: T3, lastOptInAt: T2 })
    expect(await db.one(sql`SELECT ${count('n')} FROM sms_phone_states`)).toEqual({ n: 1 })
  })

  it('creates the opt-in row for a new phone', async () => {
    await recordSmsPhoneOptIn(PHONE, T0)
    expect(await findSmsPhoneConsentState(PHONE)).toEqual({ optedOutAt: null, lastOptInAt: T0 })
  })

  it('reads only the state of the asked phone', async () => {
    await recordSmsPhoneOptOut(OTHER_PHONE, T0)
    await recordSmsPhoneOptIn(PHONE, T1)

    expect(await findSmsPhoneOptOut(PHONE)).toEqual({ optedOutAt: null })
    expect(await findSmsPhoneConsentState(OTHER_PHONE)).toEqual({
      optedOutAt: T0,
      lastOptInAt: null,
    })
    expect(await findSmsPhoneOptOut(UNKNOWN_PHONE)).toBeNull()
    expect(await findSmsPhoneConsentState(UNKNOWN_PHONE)).toBeNull()
  })
})

describe('outbound message lifecycle', () => {
  it('creates a queued outbound message and returns the stored row', async () => {
    const ticket = await seedTicket()
    const message = await createOutboundSmsMessage({
      supportTicketId: ticket.id,
      type: 'SUPPORT_REPLY',
      to: PHONE,
      from: SUPPORT_NUMBER,
      body: 'Hello',
    })

    expect(message).toEqual(await readMessage(message.id))
    expect(message).toMatchObject({
      submissionId: null,
      supportTicketId: ticket.id,
      type: 'SUPPORT_REPLY',
      direction: 'outbound',
      to: PHONE,
      from: SUPPORT_NUMBER,
      body: 'Hello',
      providerMessageId: null,
      providerStatus: 'queued',
      sentAt: null,
      finalizedAt: null,
    })
  })

  it('records provider acceptance with the provider sent time or now', async () => {
    const first = await seedMessage({ direction: 'outbound', providerStatus: 'queued' })
    const second = await seedMessage({ direction: 'outbound', providerStatus: 'queued' })

    await recordSmsMessageAccepted(first.id, {
      providerMessageId: 'msg_1',
      providerStatus: 'sent',
      providerSentAt: T1.toISOString(),
    })
    const before = Date.now()
    await recordSmsMessageAccepted(second.id, {
      providerMessageId: undefined,
      providerStatus: 'queued',
    })

    expect(await readMessage(first.id)).toMatchObject({
      providerMessageId: 'msg_1',
      providerStatus: 'sent',
      sentAt: T1,
    })
    const stored = await readMessage(second.id)
    expect(stored?.providerMessageId).toBeNull()
    expect(stored?.sentAt?.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it('records a provider rejection and a send error as finalized failures', async () => {
    const rejected = await seedMessage({ direction: 'outbound' })
    const errored = await seedMessage({ direction: 'outbound' })
    const unknown = await seedMessage({ direction: 'outbound' })

    await recordSmsMessageProviderRejection(rejected.id, {
      errorCode: '40001',
      errorMessage: 'bad',
    })
    await recordSmsMessageSendError(errored.id, new Error('boom'))
    await recordSmsMessageSendError(unknown.id, 'not an error')

    expect(await readMessage(rejected.id)).toMatchObject({
      providerStatus: 'sending_failed',
      errorCode: '40001',
      errorMessage: 'bad',
      finalizedAt: expect.any(Date),
    })
    expect(await readMessage(errored.id)).toMatchObject({
      providerStatus: 'sending_failed',
      errorCode: null,
      errorMessage: 'boom',
      finalizedAt: expect.any(Date),
    })
    expect(await readMessage(unknown.id)).toMatchObject({
      errorMessage: 'Unknown Telnyx send error',
    })
  })

  it('rejects updates to a missing message', async () => {
    await expect(recordSmsMessageSendError('missing', new Error('x'))).rejects.toThrow(
      'SMS message missing not found'
    )
  })

  it('applies sent events to the matching message until it is finalized', async () => {
    const message = await seedMessage({ direction: 'outbound', providerMessageId: 'msg_1' })
    const decoy = await seedMessage({ direction: 'outbound', providerMessageId: 'msg_2' })

    await recordSmsMessageSent('msg_1', { providerStatus: 'sent', sentAt: T1 })
    expect(await readMessage(message.id)).toMatchObject({ providerStatus: 'sent', sentAt: T1 })

    expect(
      await recordSmsMessageFinalized('msg_1', {
        providerStatus: 'delivered',
        errorCode: null,
        errorMessage: null,
        finalizedAt: T2,
      })
    ).toBe(1)
    await recordSmsMessageSent('msg_1', { providerStatus: 'sending', sentAt: T3 })
    expect(await readMessage(message.id)).toMatchObject({
      providerStatus: 'delivered',
      sentAt: T1,
      finalizedAt: T2,
    })
    expect(await readMessage(decoy.id)).toEqual(decoy)
  })

  it('finalizes with the failure details and reports an unmatched receipt as zero', async () => {
    const message = await seedMessage({ direction: 'outbound', providerMessageId: 'msg_1' })
    const receipt = {
      providerStatus: 'delivery_failed',
      errorCode: '30007',
      errorMessage: 'Carrier violation',
      finalizedAt: T2,
    }

    const decoy = await seedMessage({ direction: 'outbound', providerMessageId: 'msg_2' })

    expect(await recordSmsMessageFinalized('msg_1', receipt)).toBe(1)
    expect(await recordSmsMessageFinalized('msg_missing', receipt)).toBe(0)
    expect(await readMessage(message.id)).toMatchObject(receipt)
    expect(await readMessage(decoy.id)).toEqual(decoy)
  })
})

describe('inbound message lifecycle', () => {
  const inbound = {
    providerMessageId: 'msg_in',
    submissionId: undefined,
    to: SUPPORT_NUMBER,
    from: PHONE,
    body: 'HELP',
    providerStatus: 'received',
    receivedAt: T0,
  }

  async function inboundMessage(): Promise<SmsMessage | undefined> {
    return (await allMessages()).find((message) => message.providerMessageId === 'msg_in')
  }

  it('creates the inbound message once and updates only status and received time on replay', async () => {
    const submission = await seedSubmission()
    await upsertInboundSmsMessage({ ...inbound, submissionId: submission.id })
    await upsertInboundSmsMessage({
      ...inbound,
      body: 'CHANGED',
      providerStatus: 'delivered',
      receivedAt: T1,
    })

    const rows = await allMessages()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      submissionId: submission.id,
      type: 'INBOUND',
      direction: 'inbound',
      to: SUPPORT_NUMBER,
      from: PHONE,
      body: 'HELP',
      providerMessageId: 'msg_in',
      providerStatus: 'delivered',
      receivedAt: T1,
    })
  })

  it('leaves the provider status alone when the replay carries none', async () => {
    await upsertInboundSmsMessage(inbound)
    await upsertInboundSmsMessage({ ...inbound, providerStatus: undefined, receivedAt: T1 })

    expect(await allMessages()).toMatchObject([{ providerStatus: 'received', receivedAt: T1 }])
  })

  it('stamps support handling and links only the matching message to a ticket', async () => {
    const decoy = await seedMessage({ providerMessageId: 'msg_decoy' })
    await upsertInboundSmsMessage(inbound)
    const ticket = await seedTicket()
    const submission = await seedSubmission()

    expect(await findSmsMessageSupportHandledAt('msg_in')).toEqual({ supportHandledAt: null })
    expect(await findSmsMessageSupportHandledAt('msg_other')).toBeNull()

    await markSmsMessageSupportHandled('msg_in')
    expect((await findSmsMessageSupportHandledAt('msg_in'))?.supportHandledAt).toBeInstanceOf(Date)
    expect(await findSmsMessageSupportHandledAt('msg_decoy')).toEqual({ supportHandledAt: null })

    await linkSmsMessageToSupportTicket('msg_in', {
      supportTicketId: ticket.id,
      submissionId: submission.id,
    })
    expect(await inboundMessage()).toMatchObject({
      supportTicketId: ticket.id,
      submissionId: submission.id,
    })

    await linkSmsMessageToSupportTicket('msg_in', {
      supportTicketId: ticket.id,
      submissionId: null,
    })
    expect(await inboundMessage()).toMatchObject({ supportTicketId: ticket.id, submissionId: null })
    expect(await readMessage(decoy.id)).toEqual(decoy)
  })
})

describe('ticket creation and lookup', () => {
  it('creates an inbound ticket in the intro menu and returns the stored row', async () => {
    const submission = await seedSubmission()
    const ticket = await createInboundSupportTicket({
      phoneE164: PHONE,
      submissionId: submission.id,
      lastInboundAt: T0,
    })

    expect(ticket).toEqual(await readTicket(ticket.id))
    expect(ticket).toMatchObject({
      phoneE164: PHONE,
      submissionId: submission.id,
      status: SMS_SUPPORT_STATUS.OPEN,
      state: SMS_SUPPORT_STATE.INTRO_MENU,
      source: SMS_SUPPORT_SOURCE.INBOUND_SMS,
      category: null,
      collectedData: null,
      retryCount: 0,
      lastInboundAt: T0,
      closedAt: null,
    })
  })

  it('creates an admin ticket in CSR review and returns only its id', async () => {
    const submission = await seedSubmission()
    const created = await createAdminSupportTicket({
      phoneE164: PHONE,
      submissionId: submission.id,
      adminSummary: 'Admin opened support ticket for Ada Lovelace.',
    })

    expect(Object.keys(created)).toEqual(['id'])
    expect(await readTicket(created.id)).toMatchObject({
      phoneE164: PHONE,
      submissionId: submission.id,
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      category: SMS_SUPPORT_CATEGORY.OTHER,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      source: SMS_SUPPORT_SOURCE.ADMIN_CREATED,
      adminSummary: 'Admin opened support ticket for Ada Lovelace.',
    })
  })

  it('finds the most recently updated active ticket for the phone and skips closed ones', async () => {
    const older = await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR })
    const newer = await seedTicket({ status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER })
    const closed = await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED })
    await seedTicket({ phoneE164: OTHER_PHONE })
    await touch(older.id, T0)
    await touch(newer.id, T1)
    await touch(closed.id, T2)

    expect(await findActiveSupportTicketForPhone(PHONE)).toEqual(await readTicket(newer.id))
    expect(await findActiveSupportTicketSummaryForPhone(PHONE)).toEqual({
      id: newer.id,
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      submissionId: null,
    })
    expect(await findActiveSupportTicketForPhone(UNKNOWN_PHONE)).toBeNull()
  })

  it('reads the contact, outbound, alert and retry projections of the asked ticket only', async () => {
    const submission = await seedSubmission()
    await seedTicket({
      phoneE164: OTHER_PHONE,
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      automationKind: 'OTHER',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
      collectedData: { other: true },
      lastOutboundAt: T0,
      csrAlertedAt: T1,
    })
    const ticket = await seedTicket({
      submissionId: submission.id,
      automationKind: 'UPDATE_DOB_REISSUE_NOTE',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
      collectedData: { patientDateOfBirth: '1990-01-01' },
    })

    expect(await findSupportTicketContact(ticket.id)).toEqual({
      id: ticket.id,
      phoneE164: PHONE,
      submissionId: submission.id,
    })
    expect(await findSupportTicketLastOutboundAt(ticket.id)).toEqual({ lastOutboundAt: null })
    expect(await findSupportTicketCsrAlert(ticket.id)).toEqual({ csrAlertedAt: null })
    expect(await findSupportTicketForAutomationRetry(ticket.id)).toEqual({
      id: ticket.id,
      automationKind: 'UPDATE_DOB_REISSUE_NOTE',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
      collectedData: { patientDateOfBirth: '1990-01-01' },
      status: SMS_SUPPORT_STATUS.OPEN,
    })
    expect(await findSupportTicketContact('missing')).toBeNull()
    expect(await findSupportTicketLastOutboundAt('missing')).toBeNull()
    expect(await findSupportTicketCsrAlert('missing')).toBeNull()
    expect(await findSupportTicketForAutomationRetry('missing')).toBeNull()
  })

  it('lists ticket ids by status up to the limit', async () => {
    await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR })
    await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR })
    await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED })

    const rows = await findSupportTicketIdsByStatus(SMS_SUPPORT_STATUS.NEEDS_CSR, 5)
    expect(rows).toHaveLength(2)
    expect(Object.keys(rows[0])).toEqual(['id'])
    expect(await findSupportTicketIdsByStatus(SMS_SUPPORT_STATUS.NEEDS_CSR, 1)).toHaveLength(1)
  })
})

describe('ticket conversation lifecycle', () => {
  it('stamps an inbound, linking the matched submission or keeping the current one', async () => {
    const submission = await seedSubmission()
    const ticket = await seedTicket({ closedAt: T0 })

    const linked = await recordSupportTicketInbound(ticket.id, {
      matchedSubmissionId: submission.id,
      lastInboundAt: T1,
    })
    expect(linked).toEqual(await readTicket(ticket.id))
    expect(linked).toMatchObject({ submissionId: submission.id, lastInboundAt: T1, closedAt: null })

    const touched = await recordSupportTicketInbound(ticket.id, { lastInboundAt: T2 })
    expect(touched).toMatchObject({ submissionId: submission.id, lastInboundAt: T2 })
  })

  it('writes a conversation update including jsonb collected data', async () => {
    const ticket = await seedTicket({ updatedAt: T0 })

    const updated = await updateSupportTicketConversation(ticket.id, {
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
      collectedData: { notePurpose: 'both', otherNotePurpose: null },
    })

    expect(updated).toEqual(await readTicket(ticket.id))
    expect(updated).toMatchObject({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.CHANGE_PURPOSE,
      collectedData: { notePurpose: 'both', otherNotePurpose: null },
    })
    expect(updated.updatedAt.getTime()).toBeGreaterThan(T0.getTime())
  })

  it('escalates to CSR review with the summary and collected data', async () => {
    const ticket = await seedTicket()

    const escalated = await escalateSupportTicketToCsr(ticket.id, {
      category: SMS_SUPPORT_CATEGORY.OTHER,
      adminSummary: 'Customer message: flu',
      collectedData: { freeformMessage: 'flu' },
    })

    expect(escalated).toEqual(await readTicket(ticket.id))
    expect(escalated).toMatchObject({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      category: SMS_SUPPORT_CATEGORY.OTHER,
      adminSummary: 'Customer message: flu',
      collectedData: { freeformMessage: 'flu' },
    })
  })

  it('marks a failed reply for CSR review and reopens a closed ticket', async () => {
    const ticket = await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED, closedAt: T0 })

    const failed = await markSupportTicketReplyFailed(ticket.id, 'Support SMS send failed: timeout')

    expect(failed).toMatchObject({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      failureReason: 'Support SMS send failed: timeout',
      adminSummary: 'Support SMS failed to send. Admin should contact the customer manually.',
      closedAt: null,
    })
  })

  it('assigns a submission and rejects a missing ticket', async () => {
    const submission = await seedSubmission()
    const ticket = await seedTicket()

    await assignSupportTicketSubmission(ticket.id, submission.id)
    expect((await readTicket(ticket.id))?.submissionId).toBe(submission.id)
    await expect(assignSupportTicketSubmission('missing', submission.id)).rejects.toThrow(
      'Support ticket missing not found'
    )
  })

  it('stamps outbound time and alerts the CSR only once, on the asked ticket only', async () => {
    const ticket = await seedTicket()
    const decoy = await seedTicket({ phoneE164: OTHER_PHONE })
    const alerted = await seedTicket({ csrAlertedAt: T0 })

    await recordSupportTicketOutbound(ticket.id)
    const { lastOutboundAt } = (await findSupportTicketLastOutboundAt(ticket.id)) ?? {}
    expect(lastOutboundAt).toBeInstanceOf(Date)

    await markSupportTicketCsrAlerted(ticket.id)
    const first = (await findSupportTicketCsrAlert(ticket.id))?.csrAlertedAt
    expect(first).toBeInstanceOf(Date)
    await markSupportTicketCsrAlerted(ticket.id)
    expect((await findSupportTicketCsrAlert(ticket.id))?.csrAlertedAt).toEqual(first)
    await markSupportTicketCsrAlerted(alerted.id)
    expect(await readTicket(alerted.id)).toEqual(alerted)
    expect(await readTicket(decoy.id)).toEqual(decoy)
  })

  it('records an admin reply and a failed admin reply', async () => {
    const ticket = await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR, csrAlertedAt: T0 })

    await markSupportTicketAdminReplied(ticket.id)
    expect(await readTicket(ticket.id)).toMatchObject({
      status: SMS_SUPPORT_STATUS.OPEN,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      adminSummary: 'Admin replied by SMS.',
      csrAlertedAt: null,
    })

    await markSupportTicketAdminReplyFailed(ticket.id, 'Telnyx timeout')
    expect(await readTicket(ticket.id)).toMatchObject({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      adminSummary: 'Admin reply failed to send by SMS.',
      failureReason: 'Telnyx timeout',
    })
  })

  it('closes by admin and returns to CSR review, reporting only the submission id', async () => {
    const submission = await seedSubmission()
    const ticket = await seedTicket({ submissionId: submission.id })

    expect(await closeSupportTicketByAdmin(ticket.id, T1)).toEqual({ submissionId: submission.id })
    expect(await readTicket(ticket.id)).toMatchObject({
      status: SMS_SUPPORT_STATUS.CLOSED,
      state: SMS_SUPPORT_STATE.CLOSED,
      closedAt: T1,
    })

    expect(await returnSupportTicketToCsrReview(ticket.id)).toEqual({ submissionId: submission.id })
    expect(await readTicket(ticket.id)).toMatchObject({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      closedAt: null,
    })
  })
})

describe('ticket automation lifecycle', () => {
  it('starts a retry, incrementing the retry count each time', async () => {
    const ticket = await seedTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
      failureReason: 'boom',
    })

    await startSupportAutomationRetry(ticket.id, null)
    expect(await readTicket(ticket.id)).toMatchObject({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
      adminSummary: 'Retry started.',
      failureReason: null,
      retryCount: 1,
    })

    await startSupportAutomationRetry(ticket.id, 'DOB fix')
    expect(await readTicket(ticket.id)).toMatchObject({
      adminSummary: 'Retry started: DOB fix',
      retryCount: 2,
    })
  })

  it('escalates after an automation failure and returns the row', async () => {
    const ticket = await seedTicket({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
    })

    const escalated = await escalateSupportTicketAfterAutomationFailure(ticket.id, 'Resend timeout')

    expect(escalated).toEqual(await readTicket(ticket.id))
    expect(escalated).toMatchObject({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      state: 'CSR_REVIEW',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
      failureReason: 'Resend timeout',
    })
  })

  it('claims the automation run only while the ticket is running automation with an active status', async () => {
    const queued = await seedTicket({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
      failureReason: 'old',
    })
    const failed = await seedTicket({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
    })
    const needsCsr = await seedTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    })
    const otherQueued = await seedTicket({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    })

    expect(await claimSupportTicketAutomationRun(queued.id)).toBe(1)
    expect(await readTicket(otherQueued.id)).toEqual(otherQueued)
    expect(await readTicket(queued.id)).toMatchObject({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
      failureReason: null,
    })
    expect(await claimSupportTicketAutomationRun(queued.id)).toBe(1)
    expect(await claimSupportTicketAutomationRun(failed.id)).toBe(0)
    expect(await claimSupportTicketAutomationRun(needsCsr.id)).toBe(0)
  })

  it('closes after automation only the asked ticket while it is running automation', async () => {
    const running = await seedTicket({ status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION })
    const needsCsr = await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR })
    const otherRunning = await seedTicket({ status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION })

    await closeSupportTicketAfterAutomation(running.id, 'Note reissued.')
    await closeSupportTicketAfterAutomation(needsCsr.id, 'Note reissued.')

    expect(await readTicket(running.id)).toMatchObject({
      status: SMS_SUPPORT_STATUS.CLOSED,
      state: 'CLOSED',
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED,
      adminSummary: 'Note reissued.',
      failureReason: null,
      closedAt: expect.any(Date),
    })
    expect(await readTicket(needsCsr.id)).toEqual(needsCsr)
    expect(await readTicket(otherRunning.id)).toEqual(otherRunning)
  })
})

describe('job creation', () => {
  it('creates a queued automation job and returns null while one is active', async () => {
    const ticket = await seedTicket()

    const job = (await createSupportAutomationJob({ ticketId: ticket.id, payload: dobPayload }))!
    expect(job).toEqual(await readJob(job.id))
    expect(job).toMatchObject({
      ticketId: ticket.id,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: dobPayload,
      attempts: 0,
      lockedAt: null,
      runAfter: expect.any(Date),
    })

    expect(
      await createSupportAutomationJob({ ticketId: ticket.id, payload: dobPayload })
    ).toBeNull()
    expect(await db.one(sql`SELECT ${count('n')} FROM sms_support_jobs`)).toEqual({ n: 1 })

    await failSupportJob(job.id, 'gave up')
    expect(
      await createSupportAutomationJob({ ticketId: ticket.id, payload: dobPayload })
    ).not.toBeNull()
  })

  it('creates a retry job with a null payload and throws while one is active', async () => {
    const ticket = await seedTicket()

    const job = await createRetrySupportAutomationJob({ ticketId: ticket.id, payload: null })
    expect(job).toEqual(await readJob(job.id))
    expect(job).toMatchObject({ status: SMS_SUPPORT_JOB_STATUS.QUEUED, payload: null })

    await expect(
      createRetrySupportAutomationJob({ ticketId: ticket.id, payload: dobPayload })
    ).rejects.toThrow(/sms_support_jobs_active_ticket_kind_key/)
  })

  it('rejects a job for a ticket that does not exist', async () => {
    await expect(
      createRetrySupportAutomationJob({ ticketId: 'missing', payload: null })
    ).rejects.toThrow(/foreign key/)
  })
})

describe('job lookup', () => {
  it('finds the newest active job, its id, and the latest job of the asked ticket only', async () => {
    const ticket = await seedTicket()
    const other = await seedTicket({ phoneE164: OTHER_PHONE })
    const failed = await seedJob(ticket.id, {
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      createdAt: T0,
    })
    const committing = await seedJob(ticket.id, {
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      createdAt: T1,
    })
    await seedJob(ticket.id, { kind: 'OTHER', createdAt: T2 })
    const elsewhere = await seedJob(other.id, {
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      createdAt: T3,
    })

    expect(await findActiveSupportAutomationJob(ticket.id)).toEqual(committing)
    expect(await findActiveSupportAutomationJobId(ticket.id)).toEqual({ id: committing.id })
    expect(await findLatestSupportAutomationJob(ticket.id)).toEqual(committing)
    expect(await findCommittingSupportJob(ticket.id)).toEqual({ id: committing.id })
    expect(await findSupportJobStatus(failed.id)).toEqual({ status: SMS_SUPPORT_JOB_STATUS.FAILED })
    expect(await findSupportJobStatus(elsewhere.id)).toEqual({
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
    })
    expect(await findSupportJobStatus('missing')).toBeNull()

    await failSupportJob(committing.id, 'stalled')
    expect(await findActiveSupportAutomationJob(ticket.id)).toBeNull()
    expect(await findActiveSupportAutomationJobId(ticket.id)).toBeNull()
    expect((await findLatestSupportAutomationJob(ticket.id))?.id).toBe(committing.id)
    expect(await findCommittingSupportJob(ticket.id)).toBeNull()
    expect(await readJob(elsewhere.id)).toEqual(elsewhere)
  })

  it('returns a job with its own ticket nested', async () => {
    const other = await seedTicket({ phoneE164: OTHER_PHONE })
    const otherJob = await seedJob(other.id)
    const ticket = await seedTicket({ collectedData: { pendingCategory: 'CHANGE_DOB' } })
    const job = await seedJob(ticket.id)

    expect(await findSupportJobWithTicket(job.id)).toEqual({ ...job, ticket })
    expect(await findSupportJobWithTicket(otherJob.id)).toEqual({ ...otherJob, ticket: other })
    expect(await findSupportJobWithTicket('missing')).toBeNull()
  })

  it('finds a runnable queued job only when due and its ticket is running automation', async () => {
    const runningTicket = () =>
      seedTicket({
        status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
        automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
      })
    const running = await runningTicket()
    const later = await runningTicket()
    const needsCsr = await seedTicket({
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    })
    const blocked = await seedTicket({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.BLOCKED,
    })
    const due = await seedJob(running.id, { runAfter: new Date() })
    const future = await seedJob(later.id, { runAfter: new Date(Date.now() + 60_000) })
    const notRunningAutomation = await seedJob(needsCsr.id)
    const automationBlocked = await seedJob(blocked.id)

    expect(await findRunnableQueuedSupportJob(due.id)).toEqual({ id: due.id, ticketId: running.id })
    expect(await findRunnableQueuedSupportJob(future.id)).toBeNull()
    expect(await findRunnableQueuedSupportJob(notRunningAutomation.id)).toBeNull()
    expect(await findRunnableQueuedSupportJob(automationBlocked.id)).toBeNull()

    await claimQueuedSupportJob(due.id, 'worker')
    expect(await findRunnableQueuedSupportJob(due.id)).toBeNull()
  })

  it('lists runnable jobs oldest first up to the limit', async () => {
    const tickets = await Promise.all(
      [0, 1, 2].map(() =>
        seedTicket({
          status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
          automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
        })
      )
    )
    const newest = await seedJob(tickets[0].id, { createdAt: T2, runAfter: T0 })
    const oldest = await seedJob(tickets[1].id, { createdAt: T0, runAfter: T0 })
    const middle = await seedJob(tickets[2].id, { createdAt: T1, runAfter: T0 })
    await seedJob(tickets[2].id, {
      kind: 'OTHER',
      createdAt: T0,
      runAfter: new Date(Date.now() + 60_000),
    })

    expect(await findRunnableQueuedSupportJobs(10)).toEqual([oldest, middle, newest])
    expect(await findRunnableQueuedSupportJobs(2)).toEqual([oldest, middle])
  })
})

describe('job claiming and completion', () => {
  it('lets exactly one of two concurrent claims win', async () => {
    const ticket = await seedTicket()
    const job = await seedJob(ticket.id)

    const [claimA, claimB] = await Promise.all([
      claimQueuedSupportJob(job.id, 'worker-a'),
      claimQueuedSupportJob(job.id, 'worker-b'),
    ])

    expect(claimA + claimB).toBe(1)
    expect(await readJob(job.id)).toMatchObject({
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      attempts: 1,
      lockedAt: expect.any(Date),
      lockedBy: claimA === 1 ? 'worker-a' : 'worker-b',
    })
  })

  it('claims each of two queued jobs for exactly one of its racing workers and leaves a third alone', async () => {
    const [first, second, idle] = await Promise.all(
      [0, 1, 2].map(async () => seedJob((await seedTicket()).id))
    )

    const claims = await Promise.all([
      claimQueuedSupportJob(first.id, 'worker-a'),
      claimQueuedSupportJob(second.id, 'worker-b'),
      claimQueuedSupportJob(first.id, 'worker-c'),
      claimQueuedSupportJob(second.id, 'worker-d'),
    ])

    expect(claims[0] + claims[2]).toBe(1)
    expect(claims[1] + claims[3]).toBe(1)
    expect(await readJob(first.id)).toMatchObject({
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      attempts: 1,
      lockedBy: claims[0] === 1 ? 'worker-a' : 'worker-c',
    })
    expect(await readJob(second.id)).toMatchObject({
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      attempts: 1,
      lockedBy: claims[1] === 1 ? 'worker-b' : 'worker-d',
    })
    expect(await readJob(idle.id)).toEqual(idle)
  })

  it('completes a job, clearing its lock and last error', async () => {
    const ticket = await seedTicket()
    const job = await seedJob(ticket.id, {
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: T0,
      lockedBy: 'worker',
      lastError: 'earlier',
    })

    await completeSupportJob(job.id)

    expect(await readJob(job.id)).toMatchObject({
      status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
      completedAt: expect.any(Date),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    })
    await expect(completeSupportJob('missing')).rejects.toThrow('Support job missing not found')
  })

  it('fails a job with its error', async () => {
    const ticket = await seedTicket()
    const job = await seedJob(ticket.id, { status: SMS_SUPPORT_JOB_STATUS.RUNNING, lockedBy: 'w' })

    await failSupportJob(job.id, 'Resend timeout')

    expect(await readJob(job.id)).toMatchObject({
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError: 'Resend timeout',
      completedAt: expect.any(Date),
    })
  })

  it('fails only the queued and running jobs of the ticket', async () => {
    const ticket = await seedTicket()
    const other = await seedTicket()
    const queued = await seedJob(ticket.id, { kind: 'A' })
    const running = await seedJob(ticket.id, {
      kind: 'B',
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: T0,
      lockedBy: 'w',
    })
    const committing = await seedJob(ticket.id, {
      kind: 'C',
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
    })
    const succeeded = await seedJob(ticket.id, {
      kind: 'D',
      status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
    })
    const elsewhere = await seedJob(other.id)

    await failQueuedOrRunningSupportJobs(ticket.id, {
      lastError: 'Ticket escalated to admin before automation ran',
      completedAt: T1,
    })

    for (const job of [queued, running]) {
      expect(await readJob(job.id)).toMatchObject({
        status: SMS_SUPPORT_JOB_STATUS.FAILED,
        lockedAt: null,
        lockedBy: null,
        lastError: 'Ticket escalated to admin before automation ran',
        completedAt: T1,
      })
    }
    expect(await readJob(committing.id)).toEqual(committing)
    expect(await readJob(succeeded.id)).toEqual(succeeded)
    expect(await readJob(elsewhere.id)).toEqual(elsewhere)
  })
})

describe('stale job recovery', () => {
  it('requeues running jobs locked before the cutoff and leaves fresh locks alone', async () => {
    const ticket = await seedTicket()
    const stale = await seedJob(ticket.id, {
      kind: 'A',
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: T0,
      lockedBy: 'w',
      runAfter: T0,
    })
    const fresh = await seedJob(ticket.id, {
      kind: 'B',
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: T2,
      lockedBy: 'w',
    })
    const committing = await seedJob(ticket.id, {
      kind: 'C',
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      lockedAt: T0,
    })

    await requeueStaleRunningSupportJobs(T1)

    const requeued = await readJob(stale.id)
    expect(requeued).toMatchObject({
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      lockedAt: null,
      lockedBy: null,
      lastError: 'Recovered stale running job lock',
    })
    expect(requeued!.runAfter.getTime()).toBeGreaterThan(T0.getTime())
    expect(await readJob(fresh.id)).toEqual(fresh)
    expect(await readJob(committing.id)).toEqual(committing)
  })

  it('lists stale committing jobs with their ticket and fails each one exactly once', async () => {
    const other = await seedTicket({ phoneE164: OTHER_PHONE })
    const ticket = await seedTicket({ status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION })
    const stale = await seedJob(ticket.id, {
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      lockedAt: T0,
    })
    const otherStale = await seedJob(other.id, {
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      lockedAt: T0,
    })
    const fresh = await seedJob(ticket.id, {
      kind: 'B',
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      lockedAt: T2,
    })
    const staleRunning = await seedJob(ticket.id, {
      kind: 'C',
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: T0,
    })
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)

    expect((await findStaleCommittingSupportJobs(T1, 10)).sort(byId)).toEqual(
      [
        { ...stale, ticket },
        { ...otherStale, ticket: other },
      ].sort(byId)
    )
    expect(await findStaleCommittingSupportJobs(T1, 1)).toHaveLength(1)
    expect(await findStaleCommittingSupportJobs(T1, 0)).toEqual([])

    const options = { staleBefore: T1, lastError: 'stalled' }
    expect(await failStaleCommittingSupportJob(fresh.id, options)).toBe(0)
    expect(await failStaleCommittingSupportJob(staleRunning.id, options)).toBe(0)
    const outcomes = await Promise.all([
      failStaleCommittingSupportJob(stale.id, options),
      failStaleCommittingSupportJob(stale.id, options),
    ])
    expect(outcomes.sort()).toEqual([0, 1])
    expect(await readJob(stale.id)).toMatchObject({
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError: 'stalled',
      completedAt: expect.any(Date),
    })
    for (const job of [otherStale, fresh, staleRunning]) {
      expect(await readJob(job.id)).toEqual(job)
    }
    expect(await findStaleCommittingSupportJobs(T1, 10)).toEqual([{ ...otherStale, ticket: other }])
  })
})

describe('queue and detail reads', () => {
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

  it('lists active tickets newest first with the submission, latest message and latest job', async () => {
    const submission = await seedSubmission()
    const withSubmission = await seedTicket({ submissionId: submission.id })
    const bare = await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR })
    const closed = await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED })
    await touch(withSubmission.id, T0)
    await touch(bare.id, T1)
    await touch(closed.id, T2)
    await seedMessage({ supportTicketId: withSubmission.id, body: 'first', createdAt: T0 })
    const latestMessage = await seedMessage({
      supportTicketId: withSubmission.id,
      body: 'latest',
      createdAt: T1,
    })
    await seedMessage({ supportTicketId: closed.id, body: 'elsewhere', createdAt: T2 })
    await seedJob(withSubmission.id, {
      kind: 'A',
      status: SMS_SUPPORT_JOB_STATUS.FAILED,
      createdAt: T0,
    })
    const latestJob = await seedJob(withSubmission.id, { createdAt: T1, attempts: 2 })

    const queue = await findActiveSupportTicketsForQueue()

    expect(queue).toEqual([
      { ...(await readTicket(bare.id)), submission: null, messages: [], jobs: [] },
      {
        ...(await readTicket(withSubmission.id)),
        submission: pick(submission, listSubmissionKeys),
        messages: [pick(latestMessage, listMessageKeys)],
        jobs: [pick(latestJob, listJobKeys)],
      },
    ])
    expect(queue[1].submission).toMatchObject({ firstDayOff: DAY_OFF, status: 'PENDING_REVIEW' })
  })

  it('filters by one status and limits closed tickets', async () => {
    const needsCsr = await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR })
    await seedTicket({ status: SMS_SUPPORT_STATUS.OPEN })
    const olderClosed = await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED })
    const newerClosed = await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED })
    await touch(olderClosed.id, T0)
    await touch(newerClosed.id, T1)

    expect(
      (await findSupportTicketsWithStatus(SMS_SUPPORT_STATUS.NEEDS_CSR)).map((t) => t.id)
    ).toEqual([needsCsr.id])
    expect((await findClosedSupportTicketsForQueue(1)).map((t) => t.id)).toEqual([newerClosed.id])
    expect((await findClosedSupportTicketsForQueue(5)).map((t) => t.id)).toEqual([
      newerClosed.id,
      olderClosed.id,
    ])
    expect(await findSupportTicketsWithStatus('NOPE')).toEqual([])
  })

  it('returns the ticket detail with messages oldest first and jobs newest first', async () => {
    const submission = await seedSubmission({ otherNotePurpose: 'court', approvalEmailSentAt: T3 })
    const ticket = await seedTicket({ submissionId: submission.id })
    const later = await seedMessage({ supportTicketId: ticket.id, body: 'later', createdAt: T1 })
    const earlier = await seedMessage({
      supportTicketId: ticket.id,
      body: 'earlier',
      createdAt: T0,
    })
    await seedMessage({ body: 'unrelated', createdAt: T0 })
    const other = await seedTicket({ phoneE164: OTHER_PHONE })
    await seedMessage({ supportTicketId: other.id, body: 'elsewhere', createdAt: T2 })
    await seedJob(other.id, { createdAt: T2 })
    const olderJob = await seedJob(ticket.id, { kind: 'A', createdAt: T0 })
    const newerJob = await seedJob(ticket.id, { kind: 'B', createdAt: T1 })

    const detail = await findSupportTicketDetail(ticket.id)

    expect(detail).toEqual({
      ...ticket,
      submission: pick(submission, [
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
      ]),
      messages: [earlier, later].map((message) =>
        pick(message, [
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
        ])
      ),
      jobs: [newerJob, olderJob].map((job) =>
        pick(job, [
          'id',
          'kind',
          'status',
          'attempts',
          'lastError',
          'runAfter',
          'lockedAt',
          'completedAt',
          'createdAt',
        ])
      ),
    })
    expect(detail?.submission).toMatchObject({ patientDateOfBirth: DOB, approvalEmailSentAt: T3 })
  })

  it('returns a detail with a null submission and null for a missing ticket', async () => {
    const ticket = await seedTicket()

    expect(await findSupportTicketDetail(ticket.id)).toEqual({
      ...ticket,
      submission: null,
      messages: [],
      jobs: [],
    })
    expect(await findSupportTicketDetail('missing')).toBeNull()
  })
})
