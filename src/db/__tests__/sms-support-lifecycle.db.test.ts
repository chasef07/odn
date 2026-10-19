import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  SMS_SUPPORT_AUTOMATION_KIND,
  SMS_SUPPORT_AUTOMATION_STATUS,
  SMS_SUPPORT_CATEGORY,
  SMS_SUPPORT_JOB_KIND,
  SMS_SUPPORT_JOB_STATUS,
  SMS_SUPPORT_SOURCE,
  SMS_SUPPORT_STATE,
  SMS_SUPPORT_STATUS,
  type SmsSupportAutomationStatus,
  type SmsSupportJobStatus,
  type SmsSupportStatus,
} from '@/lib/sms-support-types'
import { db } from '../pool'
import { count, sql } from '../sql'
import { insert, selectAll, type Patch } from '../table'
import { smsSupportJobs, smsSupportTickets, submissions } from '../tables'
import type { SmsSupportJob, SmsSupportTicket, Submission } from '../types'
import {
  cancelSupportJobs,
  createAdminSupportTicket,
  createInboundSupportTicket,
  permit,
  required,
  requeueStaleSupportJobs,
  startAutomation,
  startAutomationRetry,
  takeOver,
  transition,
  transitionJob,
  type Conversing,
  type JobInput,
  type JobTransition,
  type TicketInput,
  type TicketTransition,
} from '../sms-support-lifecycle'

const PHONE = '+15551234567'
const OTHER_PHONE = '+15550000000'
const T0 = new Date('2026-06-16T12:00:00.000Z')
const AT = new Date('2026-06-16T12:30:00.000Z')
const SUMMARY = 'Change birthday to 1990-01-01'
const dobPayload = {
  kind: 'UPDATE_DOB_REISSUE_NOTE',
  category: 'CHANGE_DOB',
  updates: { patientDateOfBirth: '1990-01-01' },
}

function minutesBefore(minutes: number): Date {
  return new Date(T0.getTime() - minutes * 60 * 1000)
}

const ticketStatuses = Object.values(SMS_SUPPORT_STATUS)
const automationStatuses: (SmsSupportAutomationStatus | null)[] = [
  null,
  ...Object.values(SMS_SUPPORT_AUTOMATION_STATUS),
]
const jobStatuses = Object.values(SMS_SUPPORT_JOB_STATUS)

type State = { status: SmsSupportStatus; automationStatus: SmsSupportAutomationStatus | null }

const everyState: State[] = ticketStatuses.flatMap((status) =>
  automationStatuses.map((automationStatus) => ({ status, automationStatus }))
)

function label({ status, automationStatus }: State): string {
  return `${status}/${automationStatus ?? 'none'}`
}

async function seedSubmission(): Promise<Submission> {
  const [row] = await db.rows(
    sql`${insert(submissions, {
      stripePaymentIntentId: `pi_${randomUUID()}`,
      state: 'CA',
      recipient: 'work',
      patientFirstName: 'Ada',
      patientLastName: 'Lovelace',
      patientDateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      email: 'ada@example.com',
      phone: '5551234567',
      notePurpose: 'work',
      firstDayOff: new Date('2026-06-10T00:00:00.000Z'),
      lastDayOff: new Date('2026-06-10T00:00:00.000Z'),
      absenceReason: 'illness',
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
      category: SMS_SUPPORT_CATEGORY.REFUND,
      automationKind: SMS_SUPPORT_AUTOMATION_KIND.UPDATE_PURPOSE_REISSUE_NOTE,
      automationStatus: null,
      collectedData: { old: true },
      adminSummary: 'old summary',
      failureReason: 'old failure',
      retryCount: 3,
      csrAlertedAt: minutesBefore(5),
      lastInboundAt: minutesBefore(6),
      lastOutboundAt: minutesBefore(7),
      closedAt: minutesBefore(8),
      createdAt: T0,
      updatedAt: T0,
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
      attempts: 3,
      lockedAt: minutesBefore(5),
      lockedBy: 'old worker',
      lastError: 'old error',
      runAfter: minutesBefore(9),
      completedAt: minutesBefore(4),
      createdAt: T0,
      updatedAt: T0,
      ...patch,
    })} RETURNING ${selectAll(smsSupportJobs)}`
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

const ticketInputs: { [K in TicketTransition]: TicketInput<K> } = {
  prompt: {
    at: AT,
    from: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
    state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
    category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
    collectedData: { pendingCategory: 'CHANGE_DOB' },
    failureReason: null,
  },
  closeFound: { at: AT, from: SMS_SUPPORT_STATUS.WAITING_CUSTOMER },
  queueAutomation: {
    at: AT,
    from: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
    category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
    automationKind: SMS_SUPPORT_AUTOMATION_KIND.UPDATE_DOB_REISSUE_NOTE,
    adminSummary: SUMMARY,
    collectedData: { patientDateOfBirth: '1990-01-01' },
  },
  escalate: {
    at: AT,
    from: SMS_SUPPORT_STATUS.OPEN,
    category: SMS_SUPPORT_CATEGORY.NAME_CORRECTION,
    adminSummary: 'Name spelling correction requested: Ada',
    collectedData: { freeformMessage: 'Ada' },
  },
  replyFailed: { at: AT, failureReason: 'Support SMS send failed: timeout' },
  adminReplied: { at: AT },
  adminReplyFailed: { at: AT, failureReason: 'Admin SMS reply failed: timeout' },
  closeByAdmin: { at: AT },
  returnToCsr: { at: AT },
  retryAutomation: { at: AT, summary: SUMMARY },
  automationFailed: { at: AT, failureReason: 'Resend timeout' },
  claimAutomation: { at: AT },
  commitAutomation: { at: AT },
  automationSucceeded: {
    at: AT,
    adminSummary: 'Automated CHANGE_DOB update completed and emailed.',
  },
}

const csrReview = {
  status: SMS_SUPPORT_STATUS.NEEDS_CSR,
  state: SMS_SUPPORT_STATE.CSR_REVIEW,
}

const ticketWrites: { [K in TicketTransition]: Partial<SmsSupportTicket> } = {
  prompt: {
    status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
    state: SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
    category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
    collectedData: { pendingCategory: 'CHANGE_DOB' },
    failureReason: null,
    closedAt: null,
  },
  closeFound: {
    status: SMS_SUPPORT_STATUS.CLOSED,
    state: SMS_SUPPORT_STATE.CLOSED,
    category: SMS_SUPPORT_CATEGORY.NOTE_NOT_RECEIVED,
    adminSummary: 'Customer found the note after checking spam/junk.',
    closedAt: AT,
  },
  queueAutomation: {
    status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    category: SMS_SUPPORT_CATEGORY.CHANGE_DOB,
    automationKind: SMS_SUPPORT_AUTOMATION_KIND.UPDATE_DOB_REISSUE_NOTE,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    adminSummary: SUMMARY,
    failureReason: null,
    collectedData: { patientDateOfBirth: '1990-01-01' },
    closedAt: null,
  },
  escalate: {
    ...csrReview,
    category: SMS_SUPPORT_CATEGORY.NAME_CORRECTION,
    adminSummary: 'Name spelling correction requested: Ada',
    collectedData: { freeformMessage: 'Ada' },
    closedAt: null,
  },
  replyFailed: {
    ...csrReview,
    failureReason: 'Support SMS send failed: timeout',
    adminSummary: 'Support SMS failed to send. Admin should contact the customer manually.',
    closedAt: null,
  },
  adminReplied: {
    status: SMS_SUPPORT_STATUS.OPEN,
    state: SMS_SUPPORT_STATE.CSR_REVIEW,
    adminSummary: 'Admin replied by SMS.',
    csrAlertedAt: null,
    closedAt: null,
  },
  adminReplyFailed: {
    ...csrReview,
    adminSummary: 'Admin reply failed to send by SMS.',
    failureReason: 'Admin SMS reply failed: timeout',
    closedAt: null,
  },
  closeByAdmin: {
    status: SMS_SUPPORT_STATUS.CLOSED,
    state: SMS_SUPPORT_STATE.CLOSED,
    closedAt: AT,
  },
  returnToCsr: { ...csrReview, closedAt: null },
  retryAutomation: {
    status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    adminSummary: `Retry started: ${SUMMARY}`,
    failureReason: null,
    retryCount: 4,
    closedAt: null,
  },
  automationFailed: {
    ...csrReview,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
    failureReason: 'Resend timeout',
    closedAt: null,
  },
  claimAutomation: { automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING, failureReason: null },
  commitAutomation: { failureReason: null },
  automationSucceeded: {
    status: SMS_SUPPORT_STATUS.CLOSED,
    state: SMS_SUPPORT_STATE.CLOSED,
    automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED,
    adminSummary: 'Automated CHANGE_DOB update completed and emailed.',
    failureReason: null,
    closedAt: AT,
  },
}

type Admission = {
  statuses: readonly SmsSupportStatus[]
  automation?: readonly (SmsSupportAutomationStatus | null)[]
  pin?: Conversing
}

const conversing = (pin: Conversing): Admission => ({
  statuses: [
    SMS_SUPPORT_STATUS.OPEN,
    SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
    SMS_SUPPORT_STATUS.NEEDS_CSR,
  ],
  pin,
})
const everyStatus: Admission = { statuses: ticketStatuses }

const ticketAdmission: { [K in TicketTransition]: Admission } = {
  prompt: conversing(SMS_SUPPORT_STATUS.WAITING_CUSTOMER),
  closeFound: conversing(SMS_SUPPORT_STATUS.WAITING_CUSTOMER),
  queueAutomation: conversing(SMS_SUPPORT_STATUS.WAITING_CUSTOMER),
  escalate: conversing(SMS_SUPPORT_STATUS.OPEN),
  replyFailed: everyStatus,
  adminReplied: everyStatus,
  adminReplyFailed: everyStatus,
  closeByAdmin: everyStatus,
  returnToCsr: everyStatus,
  retryAutomation: {
    statuses: [SMS_SUPPORT_STATUS.NEEDS_CSR],
    automation: [SMS_SUPPORT_AUTOMATION_STATUS.FAILED],
  },
  automationFailed: everyStatus,
  claimAutomation: {
    statuses: [SMS_SUPPORT_STATUS.RUNNING_AUTOMATION],
    automation: [SMS_SUPPORT_AUTOMATION_STATUS.QUEUED, SMS_SUPPORT_AUTOMATION_STATUS.RUNNING],
  },
  commitAutomation: {
    statuses: [SMS_SUPPORT_STATUS.RUNNING_AUTOMATION],
    automation: [SMS_SUPPORT_AUTOMATION_STATUS.RUNNING],
  },
  automationSucceeded: { statuses: [SMS_SUPPORT_STATUS.RUNNING_AUTOMATION] },
}

function admits(admission: Admission, state: State, { pinned = true } = {}): boolean {
  return (
    admission.statuses.includes(state.status) &&
    (!pinned || admission.pin === undefined || admission.pin === state.status) &&
    (admission.automation === undefined || admission.automation.includes(state.automationStatus))
  )
}

const ticketTransitions = Object.keys(ticketInputs) as TicketTransition[]

function start(name: TicketTransition): State {
  const admission = ticketAdmission[name]
  const written = ticketWrites[name]
  const automation = admission.automation ?? [
    SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
    SMS_SUPPORT_AUTOMATION_STATUS.SUCCEEDED,
  ]
  return {
    status:
      admission.pin ??
      admission.statuses.find((status) => status !== written.status) ??
      admission.statuses[0],
    automationStatus:
      automation.find((status) => status !== written.automationStatus) ?? automation[0],
  }
}

describe('every ticket transition', () => {
  it.each(ticketTransitions)(
    '%s admits exactly its states, refuses the rest unchanged, and permit agrees with the unpinned write',
    async (name) => {
      const rows: SmsSupportTicket[] = []
      for (const state of everyState) rows.push(await seedTicket(state))
      const passed: string[] = []

      for (const row of rows) {
        const early = await permit(row.id, name)
        const written = await transition(name, row.id, ticketInputs[name])
        expect(early.ok).toBe(admits(ticketAdmission[name], row, { pinned: false }))
        if (written.ok) {
          passed.push(label(row))
        } else {
          expect(['status', 'automation']).toContain(written.refusal.reason)
          if (!early.ok) expect(written.refusal).toEqual(early.refusal)
          else expect(written.refusal).toEqual({ reason: 'status', status: row.status })
          expect(await readTicket(row.id)).toEqual(row)
        }
      }

      const expected = everyState.filter((state) => admits(ticketAdmission[name], state)).map(label)
      expect(passed.sort()).toEqual(expected.sort())
    }
  )

  it.each(ticketTransitions)(
    '%s writes exactly its columns, stamps updated_at with the input time, returns the row, and leaves a neighbour alone',
    async (name) => {
      const row = await seedTicket(start(name))
      const neighbour = await seedTicket(start(name))

      const result = await transition(name, row.id, ticketInputs[name])

      const expected = { ...row, ...ticketWrites[name], updatedAt: AT }
      expect(result).toEqual({ ok: true, value: expected })
      expect(await readTicket(row.id)).toEqual(expected)
      expect(await readTicket(neighbour.id)).toEqual(neighbour)
    }
  )

  it('refuses a missing ticket by id, not by any other row', async () => {
    await seedTicket()
    for (const name of ticketTransitions) {
      expect(await transition(name, randomUUID(), ticketInputs[name])).toEqual({
        ok: false,
        refusal: { reason: 'missing' },
      })
      expect(await permit(randomUUID(), name)).toEqual({
        ok: false,
        refusal: { reason: 'missing' },
      })
    }
  })

  it('names the live status or automation status it refused', async () => {
    const closed = await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED })
    const running = await seedTicket({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED,
    })
    const unset = await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR, automationStatus: null })

    expect(await transition('prompt', closed.id, ticketInputs.prompt)).toEqual({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.CLOSED },
    })
    expect(await transition('prompt', unset.id, ticketInputs.prompt)).toEqual({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.NEEDS_CSR },
    })
    expect(await transition('claimAutomation', running.id, { at: AT })).toEqual({
      ok: false,
      refusal: { reason: 'automation', automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.FAILED },
    })
    expect(await permit(unset.id, 'retryAutomation')).toEqual({
      ok: false,
      refusal: { reason: 'automation', automationStatus: null },
    })
  })
})

describe('prompt', () => {
  it('keeps the category, collected data, submission and failure reason it is not given', async () => {
    const submission = await seedSubmission()
    const row = await seedTicket({
      status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      submissionId: submission.id,
    })

    const result = await transition('prompt', row.id, {
      at: AT,
      from: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
      state: SMS_SUPPORT_STATE.OTHER_MENU,
    })

    expect(result).toEqual({
      ok: true,
      value: { ...row, state: SMS_SUPPORT_STATE.OTHER_MENU, closedAt: null, updatedAt: AT },
    })
  })

  it('links the submission it is given and clears the category when told to', async () => {
    const submission = await seedSubmission()
    const row = await seedTicket()

    const result = await transition('prompt', row.id, {
      at: AT,
      from: SMS_SUPPORT_STATUS.OPEN,
      state: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
      category: null,
      submissionId: submission.id,
      collectedData: {},
    })

    expect(result).toEqual({
      ok: true,
      value: {
        ...row,
        status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER,
        state: SMS_SUPPORT_STATE.CHANGE_DOB_COLLECT,
        category: null,
        submissionId: submission.id,
        collectedData: {},
        closedAt: null,
        updatedAt: AT,
      },
    })
  })
})

describe('conversation steps pinned to the status they read', () => {
  it('refuse once another text moved the ticket, and admit from the live status', async () => {
    const row = await seedTicket({ status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER, closedAt: null })
    const read = SMS_SUPPORT_STATUS.WAITING_CUSTOMER

    const escalated = await transition('escalate', row.id, { ...ticketInputs.escalate, from: read })
    expect(escalated).toMatchObject({ ok: true, value: { status: SMS_SUPPORT_STATUS.NEEDS_CSR } })

    const stale = await transition('prompt', row.id, { ...ticketInputs.prompt, from: read })
    expect(stale).toEqual({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.NEEDS_CSR },
    })
    expect(await readTicket(row.id)).toEqual(escalated.ok ? escalated.value : null)

    const live = await transition('prompt', row.id, {
      ...ticketInputs.prompt,
      from: SMS_SUPPORT_STATUS.NEEDS_CSR,
    })
    expect(live).toMatchObject({ ok: true, value: { status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER } })
  })

  it('let every text pinned to the same status through', async () => {
    const row = await seedTicket({ status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER })

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        transition('prompt', row.id, {
          ...ticketInputs.prompt,
          state: index % 2 ? SMS_SUPPORT_STATE.OTHER_MENU : SMS_SUPPORT_STATE.CHANGE_NOTE_MENU,
        })
      )
    )

    expect(results.filter((result) => result.ok)).toHaveLength(20)
  })
})

describe('retryAutomation', () => {
  it('counts each retry and says so without a summary', async () => {
    const row = await seedTicket(start('retryAutomation'))

    const first = await transition('retryAutomation', row.id, { at: AT, summary: null })
    expect(first).toMatchObject({
      ok: true,
      value: { adminSummary: 'Retry started.', retryCount: 4 },
    })

    const failedAgain = await transition('automationFailed', row.id, {
      at: AT,
      failureReason: 'again',
    })
    expect(failedAgain.ok).toBe(true)
    expect(
      await transition('retryAutomation', row.id, { at: AT, summary: 'DOB fix' })
    ).toMatchObject({ ok: true, value: { adminSummary: 'Retry started: DOB fix', retryCount: 5 } })
  })
})

describe('concurrent ticket writers', () => {
  it('lets exactly one of 20 automation requests on a waiting ticket through', async () => {
    const row = await seedTicket({ status: SMS_SUPPORT_STATUS.WAITING_CUSTOMER })

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        transition('queueAutomation', row.id, ticketInputs.queueAutomation)
      )
    )

    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.flatMap((result) => (result.ok ? [] : [result.refusal]))).toEqual(
      Array(19).fill({ reason: 'status', status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION })
    )
    expect(await readTicket(row.id)).toMatchObject({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.QUEUED,
    })
  })

  it('lets a running automation claim its ticket again', async () => {
    const row = await seedTicket({
      status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION,
      automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING,
    })

    expect(await transition('claimAutomation', row.id, { at: AT })).toMatchObject({
      ok: true,
      value: { automationStatus: SMS_SUPPORT_AUTOMATION_STATUS.RUNNING, failureReason: null },
    })
  })
})

describe('transition on a transaction', () => {
  it('writes on the given executor, so a rolled back transaction leaves the row alone', async () => {
    const row = await seedTicket()

    await expect(
      db.transaction(async (tx) => {
        const closed = await transition('closeByAdmin', row.id, { at: AT }, tx)
        expect(closed).toMatchObject({ ok: true, value: { status: SMS_SUPPORT_STATUS.CLOSED } })
        throw new Error('roll back')
      })
    ).rejects.toThrow('roll back')

    expect(await readTicket(row.id)).toEqual(row)
  })
})

describe('required', () => {
  it('returns the row of an admitted transition and throws the refusal of a refused one', async () => {
    const row = await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED })

    await expect(
      transition('escalate', row.id, ticketInputs.escalate).then((outcome) =>
        required(outcome, `escalate of support ticket ${row.id}`)
      )
    ).rejects.toThrow(`escalate of support ticket ${row.id} was refused: the status is CLOSED`)

    const reopened = required(
      await transition('returnToCsr', row.id, { at: AT }),
      `returnToCsr of support ticket ${row.id}`
    )
    expect(reopened).toMatchObject({ status: SMS_SUPPORT_STATUS.NEEDS_CSR, closedAt: null })
    expect(() =>
      required({ ok: false, refusal: { reason: 'missing' } }, 'complete of support job j')
    ).toThrow('complete of support job j was refused: the row was not found')
    expect(() =>
      required({ ok: false, refusal: { reason: 'stale' } }, 'fail of support job j')
    ).toThrow('fail of support job j was refused: the row changed while the write ran')
    expect(() =>
      required(
        { ok: false, refusal: { reason: 'automation', automationStatus: null } },
        'retryAutomation of support ticket t'
      )
    ).toThrow('retryAutomation of support ticket t was refused: the automation status is none')
  })
})

type RowStep = Exclude<JobTransition, 'cancel' | 'requeueStale'>

const jobInputs: { [K in RowStep]: JobInput<K> } = {
  claim: { at: AT, workerId: 'worker-a' },
  commit: { at: AT },
  complete: { at: AT },
  fail: { at: AT, lastError: 'Resend timeout' },
  failStale: { at: AT, lastError: 'stalled' },
}

const failedWrite = {
  status: SMS_SUPPORT_JOB_STATUS.FAILED,
  lockedAt: null,
  lockedBy: null,
  completedAt: AT,
}

const jobWrites: { [K in RowStep]: Partial<SmsSupportJob> } = {
  claim: {
    status: SMS_SUPPORT_JOB_STATUS.RUNNING,
    lockedAt: AT,
    lockedBy: 'worker-a',
    attempts: 4,
  },
  commit: { status: SMS_SUPPORT_JOB_STATUS.COMMITTING, lockedAt: AT },
  complete: {
    status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
    completedAt: AT,
    lockedAt: null,
    lockedBy: null,
    lastError: null,
  },
  fail: { ...failedWrite, lastError: 'Resend timeout' },
  failStale: { ...failedWrite, lastError: 'stalled' },
}

const jobAdmission: { [K in RowStep]: readonly SmsSupportJobStatus[] } = {
  claim: [SMS_SUPPORT_JOB_STATUS.QUEUED],
  commit: [SMS_SUPPORT_JOB_STATUS.RUNNING],
  complete: jobStatuses,
  fail: jobStatuses,
  failStale: [SMS_SUPPORT_JOB_STATUS.COMMITTING],
}

const rowSteps = Object.keys(jobInputs) as RowStep[]

describe('every job transition', () => {
  it.each(rowSteps)(
    '%s admits exactly its statuses and refuses the rest unchanged',
    async (name) => {
      const ticket = await seedTicket()
      const rows: SmsSupportJob[] = []
      for (const status of jobStatuses)
        rows.push(await seedJob(ticket.id, { kind: status, status }))
      const passed: SmsSupportJobStatus[] = []

      for (const row of rows) {
        const written = await transitionJob(name, row.id, jobInputs[name])
        if (written.ok) {
          passed.push(row.status)
        } else {
          expect(written.refusal).toEqual({ reason: 'status', status: row.status })
          expect(await readJob(row.id)).toEqual(row)
        }
      }

      expect(passed.sort()).toEqual([...jobAdmission[name]].sort())
    }
  )

  it.each(rowSteps)(
    '%s writes exactly its columns, stamps updated_at with the input time, returns the row, and leaves a neighbour alone',
    async (name) => {
      const ticket = await seedTicket()
      const other = await seedTicket({ phoneE164: OTHER_PHONE })
      const row = await seedJob(ticket.id, { status: jobAdmission[name][0] })
      const neighbour = await seedJob(other.id, { status: jobAdmission[name][0] })

      const result = await transitionJob(name, row.id, jobInputs[name])

      const expected = { ...row, ...jobWrites[name], updatedAt: AT }
      expect(result).toEqual({ ok: true, value: expected })
      expect(await readJob(row.id)).toEqual(expected)
      expect(await readJob(neighbour.id)).toEqual(neighbour)
    }
  )

  it('refuses a missing job by id, not by any other row', async () => {
    await seedJob((await seedTicket()).id)
    for (const name of rowSteps) {
      expect(await transitionJob(name, randomUUID(), jobInputs[name])).toEqual({
        ok: false,
        refusal: { reason: 'missing' },
      })
    }
  })
})

describe('concurrent job writers', () => {
  it('lets exactly one of 20 claims win and tells the others the job is running', async () => {
    const job = await seedJob((await seedTicket()).id)

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, racer) =>
        transitionJob('claim', job.id, { at: AT, workerId: `worker-${racer}` })
      )
    )

    const winners = results.flatMap((result) => (result.ok ? [result.value] : []))
    expect(winners).toHaveLength(1)
    expect(results.flatMap((result) => (result.ok ? [] : [result.refusal]))).toEqual(
      Array(19).fill({ reason: 'status', status: SMS_SUPPORT_JOB_STATUS.RUNNING })
    )
    expect(await readJob(job.id)).toEqual(winners[0])
    expect(winners[0]).toMatchObject({ attempts: 4 })
  })

  it('fails a stale committing job exactly once', async () => {
    const job = await seedJob((await seedTicket()).id, {
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
    })

    const outcomes = await Promise.all([
      transitionJob('failStale', job.id, jobInputs.failStale),
      transitionJob('failStale', job.id, jobInputs.failStale),
    ])

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1)
    expect(await readJob(job.id)).toMatchObject({ ...failedWrite, lastError: 'stalled' })
  })
})

describe('cancelSupportJobs', () => {
  it('fails the queued and running jobs of the ticket only', async () => {
    const ticket = await seedTicket()
    const other = await seedTicket({ phoneE164: OTHER_PHONE })
    const byStatus = new Map<SmsSupportJobStatus, SmsSupportJob>()
    for (const status of jobStatuses) {
      byStatus.set(status, await seedJob(ticket.id, { kind: status, status }))
    }
    const elsewhere = await seedJob(other.id)

    expect(
      await cancelSupportJobs(ticket.id, { at: AT, lastError: 'Ticket closed by admin' })
    ).toBe(2)

    for (const status of [SMS_SUPPORT_JOB_STATUS.QUEUED, SMS_SUPPORT_JOB_STATUS.RUNNING]) {
      expect(await readJob(byStatus.get(status)!.id)).toEqual({
        ...byStatus.get(status),
        ...failedWrite,
        lastError: 'Ticket closed by admin',
        updatedAt: AT,
      })
    }
    for (const status of [
      SMS_SUPPORT_JOB_STATUS.COMMITTING,
      SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
      SMS_SUPPORT_JOB_STATUS.FAILED,
    ]) {
      expect(await readJob(byStatus.get(status)!.id)).toEqual(byStatus.get(status))
    }
    expect(await readJob(elsewhere.id)).toEqual(elsewhere)
  })
})

describe('requeueStaleSupportJobs', () => {
  it('requeues running jobs locked strictly before the cutoff and leaves every other job alone', async () => {
    const ticket = await seedTicket()
    const stale = await seedJob(ticket.id, {
      kind: 'A',
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: minutesBefore(20),
    })
    const fresh = await seedJob(ticket.id, {
      kind: 'B',
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: minutesBefore(1),
    })
    const atCutoff = await seedJob(ticket.id, {
      kind: 'C',
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
      lockedAt: minutesBefore(10),
    })
    const committing = await seedJob(ticket.id, {
      kind: 'D',
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
      lockedAt: minutesBefore(20),
    })
    const queued = await seedJob(ticket.id, { kind: 'E', lockedAt: minutesBefore(20) })
    const finished = await Promise.all(
      [SMS_SUPPORT_JOB_STATUS.SUCCEEDED, SMS_SUPPORT_JOB_STATUS.FAILED].map((status) =>
        seedJob(ticket.id, { kind: status, status, lockedAt: minutesBefore(20) })
      )
    )

    expect(await requeueStaleSupportJobs(minutesBefore(10), { at: AT })).toBe(1)

    expect(await readJob(stale.id)).toEqual({
      ...stale,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      lockedAt: null,
      lockedBy: null,
      lastError: 'Recovered stale running job lock',
      runAfter: AT,
      updatedAt: AT,
    })
    for (const job of [fresh, atCutoff, committing, queued, ...finished]) {
      expect(await readJob(job.id)).toEqual(job)
    }
  })
})

describe('births', () => {
  it('opens an inbound ticket in the intro menu with the stored row', async () => {
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
      automationStatus: null,
      collectedData: null,
      retryCount: 0,
      lastInboundAt: T0,
      closedAt: null,
    })
  })

  it('opens an admin ticket in CSR review with the stored row', async () => {
    const submission = await seedSubmission()
    const ticket = await createAdminSupportTicket({
      phoneE164: PHONE,
      submissionId: submission.id,
      adminSummary: 'Admin opened support ticket for Ada Lovelace.',
    })

    expect(ticket).toEqual(await readTicket(ticket.id))
    expect(ticket).toMatchObject({
      phoneE164: PHONE,
      submissionId: submission.id,
      status: SMS_SUPPORT_STATUS.NEEDS_CSR,
      category: SMS_SUPPORT_CATEGORY.OTHER,
      state: SMS_SUPPORT_STATE.CSR_REVIEW,
      source: SMS_SUPPORT_SOURCE.ADMIN_CREATED,
      adminSummary: 'Admin opened support ticket for Ada Lovelace.',
      closedAt: null,
    })
  })
})

describe('startAutomation', () => {
  const request = { ...ticketInputs.queueAutomation, payload: dobPayload }

  it('moves the ticket and queues its job together', async () => {
    const ticket = await seedTicket(start('queueAutomation'))

    const result = await startAutomation(ticket.id, request)

    if (!result.ok) throw new Error(result.refusal.reason)
    expect(result.value.ticket).toEqual({
      ...ticket,
      ...ticketWrites.queueAutomation,
      updatedAt: AT,
    })
    expect(await readTicket(ticket.id)).toEqual(result.value.ticket)
    expect(result.value.job).toEqual(await readJob(result.value.job.id))
    expect(result.value.job).toMatchObject({
      ticketId: ticket.id,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: dobPayload,
      attempts: 0,
      lockedAt: null,
      runAfter: expect.any(Date),
    })
  })

  it('queues no job when the ticket left the status the text read', async () => {
    const ticket = await seedTicket({ status: SMS_SUPPORT_STATUS.NEEDS_CSR })

    expect(await startAutomation(ticket.id, request)).toEqual({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.NEEDS_CSR },
    })
    expect(await startAutomation(randomUUID(), request)).toEqual({
      ok: false,
      refusal: { reason: 'missing' },
    })
    expect(await readTicket(ticket.id)).toEqual(ticket)
    expect(await db.one(sql`SELECT ${count('n')} FROM sms_support_jobs`)).toEqual({ n: 0 })
  })

  it('rolls the ticket back when a job is already active', async () => {
    const ticket = await seedTicket(start('queueAutomation'))
    const active = await seedJob(ticket.id, { status: SMS_SUPPORT_JOB_STATUS.RUNNING })

    expect(await startAutomation(ticket.id, request)).toEqual({
      ok: false,
      refusal: { reason: 'job' },
    })
    expect(await readTicket(ticket.id)).toEqual(ticket)
    expect(await readJob(active.id)).toEqual(active)
    expect(await db.one(sql`SELECT ${count('n')} FROM sms_support_jobs`)).toEqual({ n: 1 })

    expect(await transitionJob('fail', active.id, jobInputs.fail)).toMatchObject({ ok: true })
    expect(await startAutomation(ticket.id, request)).toMatchObject({ ok: true })
  })
})

describe('takeOver', () => {
  const cancel = { at: AT, lastError: 'Ticket closed by admin before automation ran' }

  it('moves the ticket, then fails its queued and running jobs, and leaves other tickets and their committing jobs alone', async () => {
    const ticket = await seedTicket({ status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION })
    const other = await seedTicket({ phoneE164: OTHER_PHONE })
    const queued = await seedJob(ticket.id, {
      kind: 'queued',
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
    })
    const running = await seedJob(ticket.id, {
      kind: 'running',
      status: SMS_SUPPORT_JOB_STATUS.RUNNING,
    })
    const done = await seedJob(ticket.id, {
      kind: 'done',
      status: SMS_SUPPORT_JOB_STATUS.SUCCEEDED,
    })
    const elsewhere = await seedJob(other.id, { kind: 'queued' })
    const elsewhereCommitting = await seedJob(other.id, {
      kind: 'committing',
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
    })

    const result = await takeOver('closeByAdmin', ticket.id, cancel)

    expect(result).toEqual({
      ok: true,
      value: { ...ticket, ...ticketWrites.closeByAdmin, updatedAt: AT },
    })
    expect(await readTicket(ticket.id)).toEqual(result.ok ? result.value : null)
    for (const job of [queued, running]) {
      expect(await readJob(job.id)).toEqual({
        ...job,
        ...failedWrite,
        lastError: cancel.lastError,
        updatedAt: AT,
      })
    }
    expect(await readJob(done.id)).toEqual(done)
    expect(await readJob(elsewhere.id)).toEqual(elsewhere)
    expect(await readJob(elsewhereCommitting.id)).toEqual(elsewhereCommitting)
    expect(await readTicket(other.id)).toEqual(other)
  })

  it('refuses and rolls back while a job is committing', async () => {
    const ticket = await seedTicket({ status: SMS_SUPPORT_STATUS.RUNNING_AUTOMATION })
    const committing = await seedJob(ticket.id, {
      kind: 'committing',
      status: SMS_SUPPORT_JOB_STATUS.COMMITTING,
    })
    const queued = await seedJob(ticket.id, {
      kind: 'queued',
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
    })

    for (const name of ['closeByAdmin', 'returnToCsr', 'adminReplied'] as const) {
      expect(await takeOver(name, ticket.id, cancel)).toEqual({
        ok: false,
        refusal: { reason: 'committing' },
      })
    }
    expect(await readTicket(ticket.id)).toEqual(ticket)
    expect(await readJob(committing.id)).toEqual(committing)
    expect(await readJob(queued.id)).toEqual(queued)
  })

  it('reports a missing ticket and cancels nothing', async () => {
    const job = await seedJob((await seedTicket()).id)

    expect(await takeOver('returnToCsr', randomUUID(), cancel)).toEqual({
      ok: false,
      refusal: { reason: 'missing' },
    })
    expect(await readJob(job.id)).toEqual(job)
  })
})

describe('startAutomationRetry', () => {
  const retry = { at: AT, summary: SUMMARY, payload: null }

  it('moves the ticket and queues the retry job together', async () => {
    const ticket = await seedTicket(start('retryAutomation'))

    const result = await startAutomationRetry(ticket.id, { ...retry, payload: dobPayload })

    if (!result.ok) throw new Error(result.refusal.reason)
    expect(result.value.ticket).toEqual({
      ...ticket,
      ...ticketWrites.retryAutomation,
      updatedAt: AT,
    })
    expect(await readTicket(ticket.id)).toEqual(result.value.ticket)
    expect(result.value.job).toEqual(await readJob(result.value.job.id))
    expect(result.value.job).toMatchObject({
      ticketId: ticket.id,
      kind: SMS_SUPPORT_JOB_KIND.RUN_SUPPORT_AUTOMATION,
      status: SMS_SUPPORT_JOB_STATUS.QUEUED,
      payload: dobPayload,
    })
  })

  it('leaves the ticket alone when the retry job cannot be queued', async () => {
    const ticket = await seedTicket(start('retryAutomation'))
    const active = await seedJob(ticket.id, { status: SMS_SUPPORT_JOB_STATUS.RUNNING })

    await expect(startAutomationRetry(ticket.id, retry)).rejects.toThrow(
      /sms_support_jobs_active_ticket_kind_key/
    )

    expect(await readTicket(ticket.id)).toEqual(ticket)
    expect(await readJob(active.id)).toEqual(active)
    expect(await db.one(sql`SELECT ${count('n')} FROM sms_support_jobs`)).toEqual({ n: 1 })
  })

  it('queues no job when the ticket is refused or missing', async () => {
    const closed = await seedTicket({ status: SMS_SUPPORT_STATUS.CLOSED })

    expect(await startAutomationRetry(closed.id, retry)).toEqual({
      ok: false,
      refusal: { reason: 'status', status: SMS_SUPPORT_STATUS.CLOSED },
    })
    expect(await startAutomationRetry(randomUUID(), retry)).toEqual({
      ok: false,
      refusal: { reason: 'missing' },
    })
    expect(await db.one(sql`SELECT ${count('n')} FROM sms_support_jobs`)).toEqual({ n: 0 })
  })
})
