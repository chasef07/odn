import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetSession,
  mockRefundsCreate,
  mockRefundsList,
  mockSendApprovalEmail,
  mockSendDenialEmail,
  mockSendSms,
  mockGenerateDoctorNotePDF,
  betweenReadAndWrite,
  afterWrite,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRefundsCreate: vi.fn(),
  mockRefundsList: vi.fn(),
  mockSendApprovalEmail: vi.fn(),
  mockSendDenialEmail: vi.fn(),
  mockSendSms: vi.fn(),
  mockGenerateDoctorNotePDF: vi.fn(async () => Buffer.from('pdf')),
  betweenReadAndWrite: { run: null as null | (() => Promise<void>) },
  afterWrite: { throwOnce: null as null | string },
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendApprovalEmail: mockSendApprovalEmail,
  sendDenialEmail: mockSendDenialEmail,
  sendMaybeEmail: vi.fn(),
}))
vi.mock('@/lib/telnyx', () => ({ sendTransactionalSmsForSubmission: mockSendSms }))
vi.mock('@/lib/stripe', () => ({
  stripe: { refunds: { create: mockRefundsCreate, list: mockRefundsList } },
}))
vi.mock('@/lib/pdf/generate-pdf', () => ({
  generateDoctorNotePDF: mockGenerateDoctorNotePDF,
  generatePDFFilename: vi.fn(() => 'note.pdf'),
}))
vi.mock('@/lib/qr-code', () => ({
  generateQrCodeDataUrl: vi.fn(async () => 'data:image/png;base64,'),
}))
vi.mock('@/db/submission-lifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/submission-lifecycle')>()
  const permit: typeof actual.permit = async (id, ...names) => {
    const read = await actual.permit(id, ...names)
    const run = betweenReadAndWrite.run
    betweenReadAndWrite.run = null
    if (run) await run()
    return read
  }
  const transition: typeof actual.transition = async (step, input) => {
    const outcome = await actual.transition(step, input)
    if (afterWrite.throwOnce === step.transition) {
      afterWrite.throwOnce = null
      throw new Error(`connection reset after ${step.transition}`)
    }
    return outcome
  }
  return { ...actual, permit, transition }
})

import { approveSubmission, reApproveSubmission } from '@/app/admin/_actions/approve'
import { changeSubmissionStatus } from '@/app/admin/_actions/change-status'
import { denySubmission } from '@/app/admin/_actions/deny'
import { markAsManual, maybeSubmission } from '@/app/admin/_actions/maybe'
import {
  settleRefundReservation,
  type ActionResult,
  type RefundSettlement,
} from '@/app/admin/_actions/shared'
import { seedSubmission } from '@/db/__tests__/seed'
import { createVerifiedUser } from '@/db/auth'
import { findNoteVerificationBySlug } from '@/db/note-verifications'
import { RELEASE_TARGETS } from '@/db/submission-lifecycle'
import {
  findSubmissionById,
  findSubmissionForAdminDetail,
  insertSubmission,
  updateSubmissionDetails,
} from '@/db/submissions'
import { SubmissionStatus, type Submission } from '@/db/types'
import { createNoteVerification } from '@/lib/note-verification'

const STALE = 'Submission was already updated. Please refresh and try again.'
const DENIAL_EMAIL = {
  to: 'john@example.com',
  patientName: 'John Doe',
  denialReason: 'Legal',
  refundAmount: 24.95,
}

let adminId: string

type StripeRefund = {
  id: string
  amount: number
  status: string | null
  payment_intent: string
  metadata: Record<string, string>
}

const stripeRefunds: StripeRefund[] = []

async function listRefunds({ payment_intent }: { payment_intent?: string }) {
  return {
    data: stripeRefunds.filter(
      (refund) => payment_intent === undefined || refund.payment_intent === payment_intent
    ),
  }
}

function stripeError(type: string, message: string, code?: string): Error {
  return Object.assign(new Error(message), { type, code })
}

beforeEach(async () => {
  vi.resetAllMocks()
  betweenReadAndWrite.run = null
  afterWrite.throwOnce = null
  stripeRefunds.length = 0
  mockRefundsList.mockImplementation(listRefunds)
  const admin = await createVerifiedUser({ email: 'doc@example.com', name: 'Doc' })
  adminId = admin.id
  mockGetSession.mockResolvedValue({ user: { id: adminId, email: 'doc@example.com' } })
})

async function seedPending(): Promise<Submission> {
  const { submission } = await insertSubmission({
    stripePaymentIntentId: `pi_${crypto.randomUUID()}`,
    state: 'CA',
    recipient: 'myself',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
    email: 'john@example.com',
    phone: '(555) 123-4567',
    notePurpose: 'work',
    firstDayOff: new Date('2026-03-02T00:00:00.000Z'),
    lastDayOff: new Date('2026-03-04T00:00:00.000Z'),
    absenceReason: 'illness',
    paymentAmount: 2495,
  })
  return submission
}

async function reload(id: string): Promise<Submission> {
  const row = await findSubmissionById(id)
  if (!row) throw new Error(`submission ${id} missing`)
  return row
}

async function activeNotes(id: string): Promise<number> {
  const detail = await findSubmissionForAdminDetail(id)
  if (!detail) throw new Error(`submission ${id} missing`)
  return detail.noteVerifications.length
}

async function seedRefundedDenied(): Promise<Submission> {
  const pending = await seedPending()
  mockRefundsCreate.mockResolvedValueOnce({ id: 're_done', amount: 2495 })
  const denied = await denySubmission(pending.id, { reason: 'Legal', note: null })
  expect(denied).toEqual({ success: true })
  const row = await reload(pending.id)
  expect(row).toMatchObject({ status: SubmissionStatus.DENIED, stripeRefundId: 're_done' })
  return row
}

describe('a refunded customer must never be approved', () => {
  it('refuses the override to MAYBE and the approval of a refunded denied submission', async () => {
    const refunded = await seedRefundedDenied()

    const moved = await changeSubmissionStatus(refunded.id, SubmissionStatus.MAYBE, undefined, {
      reason: 'OTHER_REVIEW',
    })
    expect(moved).toEqual({
      success: false,
      error: 'Refund already processed for this submission',
    })
    expect(await reload(refunded.id)).toEqual(refunded)

    const approved = await approveSubmission(refunded.id)
    expect(approved).toEqual({
      success: false,
      error: 'Cannot approve submission with status: DENIED',
    })
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(await reload(refunded.id)).toEqual(refunded)
  })

  it('refuses the override to MANUAL and the manual approval of a refunded denied submission', async () => {
    const refunded = await seedRefundedDenied()

    const moved = await changeSubmissionStatus(refunded.id, SubmissionStatus.MANUAL)
    expect(moved).toEqual({
      success: false,
      error: 'Refund already processed for this submission',
    })
    expect(await reload(refunded.id)).toEqual(refunded)

    const approved = await approveSubmission(refunded.id)
    expect(approved.success).toBe(false)
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(await reload(refunded.id)).toEqual(refunded)
  })
})

describe('a failed refund restores the prior status', () => {
  it('puts a MAYBE submission back to MAYBE with its reason, note and reviewer when Stripe fails', async () => {
    const pending = await seedPending()
    const maybe = await maybeSubmission(pending.id, {
      reason: 'OTHER_REVIEW',
      internalNote: '  check the dates  ',
    })
    expect(maybe.success).toBe(true)
    const before = await reload(pending.id)
    expect(before).toMatchObject({
      status: SubmissionStatus.MAYBE,
      maybeReason: 'OTHER_REVIEW',
      maybeInternalNote: 'check the dates',
      reviewedByAdminId: adminId,
    })

    mockRefundsCreate.mockRejectedValueOnce(stripeError('StripeCardError', 'card declined'))
    const denied = await denySubmission(pending.id, { reason: 'Legal', note: null })
    expect(denied.success).toBe(false)
    expect(denied.error).toContain('card declined')

    const after = await reload(pending.id)
    expect(after).toEqual({ ...before, updatedAt: after.updatedAt })
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime())
  })

  it('keeps the row denied with its refund pending when the Stripe outcome is unknown, and refuses every later action', async () => {
    const pending = await seedPending()
    mockRefundsCreate.mockRejectedValueOnce(new Error('socket hang up'))

    const denied = await denySubmission(pending.id, { reason: 'Legal', note: null })
    expect(denied.success).toBe(false)
    expect(denied.error).toContain('refund outcome is unknown')

    const reserved = await reload(pending.id)
    expect(reserved).toMatchObject({
      status: SubmissionStatus.DENIED,
      denialReason: 'Legal',
      stripeRefundId: `pending_${pending.id}`,
      refundedAt: null,
    })
    expect(await approveSubmission(pending.id)).toMatchObject({ success: false })
    expect(
      await changeSubmissionStatus(pending.id, SubmissionStatus.MAYBE, undefined, {
        reason: 'OTHER_REVIEW',
      })
    ).toMatchObject({ success: false })
    expect(await denySubmission(pending.id, { reason: 'Legal', note: null })).toMatchObject({
      success: false,
    })
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(await reload(pending.id)).toEqual(reserved)
  })
})

describe('a refund made in the Stripe dashboard', () => {
  const SETTLED = ['succeeded', 'pending', 'requires_action']

  function dashboardRefund(row: Submission, status = 'succeeded'): StripeRefund {
    return {
      id: 're_dashboard',
      amount: 2495,
      status,
      payment_intent: row.stripePaymentIntentId,
      metadata: {},
    }
  }

  async function approvedThenRefundedInStripe(status = 'succeeded'): Promise<Submission> {
    const pending = await seedPending()
    expect(await approveSubmission(pending.id)).toEqual({ success: true })
    expect(await activeNotes(pending.id)).toBe(1)
    stripeRefunds.push(dashboardRefund(pending, status))
    mockRefundsCreate.mockRejectedValue(
      stripeError(
        'StripeInvalidRequestError',
        'Charge ch_1 has already been refunded.',
        'charge_already_refunded'
      )
    )
    return reload(pending.id)
  }

  it('leaves the detail-page deny reserved when Stripe answers charge_already_refunded', async () => {
    const approved = await approvedThenRefundedInStripe()

    const denied = await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, {
      reason: 'Legal',
      note: null,
    })
    expect(denied).toEqual({
      success: false,
      error: expect.stringContaining('refund outcome is unknown'),
    })
    expect(await reload(approved.id)).toMatchObject({
      status: SubmissionStatus.DENIED,
      denialReason: 'Legal',
      stripeRefundId: `pending_${approved.id}`,
      refundedAt: null,
    })
    expect(await approveSubmission(approved.id)).toMatchObject({ success: false })
    expect(mockSendDenialEmail).not.toHaveBeenCalled()
  })

  it.each(SETTLED)(
    'records a %s dashboard refund even when asked to release, revokes the note and sends the denial email',
    async (status) => {
      const approved = await approvedThenRefundedInStripe(status)
      await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, {
        reason: 'Legal',
        note: null,
      })

      const settled = await settleRefundReservation(approved.id, SubmissionStatus.MAYBE)
      expect(settled).toEqual({
        settled: 'recorded',
        refundId: 're_dashboard',
        notice: { success: true },
      })
      const row = await reload(approved.id)
      expect(row).toMatchObject({ status: SubmissionStatus.DENIED, stripeRefundId: 're_dashboard' })
      expect(row.refundedAt).not.toBeNull()
      expect(row.denialEmailSentAt).not.toBeNull()
      expect(await activeNotes(approved.id)).toBe(0)
      expect(mockSendDenialEmail).toHaveBeenCalledExactlyOnceWith(DENIAL_EMAIL)

      expect(await approveSubmission(approved.id)).toMatchObject({ success: false })
      expect(mockSendApprovalEmail).toHaveBeenCalledTimes(1)
      await expect(settleRefundReservation(approved.id, undefined)).rejects.toThrow(
        `submission ${approved.id} holds no refund reservation (re_dashboard)`
      )
    }
  )

  it('records nothing and releases nothing while another customer holds the only refund', async () => {
    const pending = await seedPending()
    mockRefundsCreate.mockRejectedValueOnce(new Error('socket hang up'))
    await denySubmission(pending.id, { reason: 'Legal', note: null })
    const reserved = await reload(pending.id)
    const other = await seedPending()
    stripeRefunds.push(dashboardRefund(other))

    await expect(settleRefundReservation(pending.id, undefined)).rejects.toThrow(
      `Stripe holds no refund for ${pending.stripePaymentIntentId}; rerun with --release-to`
    )
    expect(await reload(pending.id)).toEqual(reserved)
    expect(await reload(other.id)).toEqual(other)
    expect(mockSendDenialEmail).not.toHaveBeenCalled()
  })

  it('refuses a row that holds no reservation, naming its refund state', async () => {
    const pending = await seedPending()

    await expect(settleRefundReservation(pending.id, SubmissionStatus.MAYBE)).rejects.toThrow(
      `submission ${pending.id} holds no refund reservation (null)`
    )
    expect(await reload(pending.id)).toEqual(pending)
    expect(mockRefundsList).not.toHaveBeenCalled()
  })

  it('reports a refund another run recorded first as recorded, without a second email', async () => {
    const approved = await approvedThenRefundedInStripe()
    await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, {
      reason: 'Legal',
      note: null,
    })
    mockRefundsList.mockImplementationOnce(async (params) => {
      expect(await settleRefundReservation(approved.id, undefined)).toMatchObject({
        settled: 'recorded',
      })
      return listRefunds(params)
    })

    expect(await settleRefundReservation(approved.id, undefined)).toEqual({
      settled: 'recorded',
      refundId: 're_dashboard',
      notice: { success: true, warning: 'Refund re_dashboard was already recorded by another run' },
    })
    expect(await reload(approved.id)).toMatchObject({
      status: SubmissionStatus.DENIED,
      stripeRefundId: 're_dashboard',
    })
    expect(mockSendDenialEmail).toHaveBeenCalledTimes(1)
  })

  function recordedNotice(settled: RefundSettlement): ActionResult {
    if (settled.settled !== 'recorded') throw new Error(`settlement ${settled.settled}`)
    expect(settled.refundId).toBe('re_dashboard')
    return settled.notice
  }

  async function expectOneDenial(id: string, outcomes: ActionResult[]): Promise<void> {
    expect(mockSendDenialEmail).toHaveBeenCalledExactlyOnceWith(DENIAL_EMAIL)
    expect(outcomes).toHaveLength(2)
    expect(outcomes).toEqual(
      expect.arrayContaining([
        { success: true },
        { success: true, warning: 'Refund re_dashboard was already recorded by another run' },
      ])
    )
    const row = await reload(id)
    expect(row).toMatchObject({ status: SubmissionStatus.DENIED, stripeRefundId: 're_dashboard' })
    expect(row.denialEmailSentAt).not.toBeNull()
    expect(await activeNotes(id)).toBe(0)
  }

  it('sends one denial email when two settles race on one reserved row', async () => {
    const approved = await approvedThenRefundedInStripe()
    await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, {
      reason: 'Legal',
      note: null,
    })
    const refundsBefore = mockRefundsCreate.mock.calls.length

    const settled = await Promise.all([
      settleRefundReservation(approved.id, undefined),
      settleRefundReservation(approved.id, undefined),
    ])

    await expectOneDenial(approved.id, settled.map(recordedNotice))
    expect(mockRefundsCreate).toHaveBeenCalledTimes(refundsBefore)
  })

  it('sends one denial email when a settle races the queue deny on the row it reserved', async () => {
    const pending = await seedPending()
    const settling = new Promise<RefundSettlement>((resolve, reject) => {
      mockRefundsCreate.mockImplementationOnce(async () => {
        stripeRefunds.push(dashboardRefund(pending))
        settleRefundReservation(pending.id, undefined).then(resolve, reject)
        return { id: 're_dashboard', amount: 2495 }
      })
    })

    const [denied, settled] = await Promise.all([
      denySubmission(pending.id, { reason: 'Legal', note: null }),
      settling,
    ])

    await expectOneDenial(pending.id, [denied, recordedNotice(settled)])
    expect(mockRefundsCreate).toHaveBeenCalledTimes(1)
  })

  it('finishes the denial itself when its own record committed but the reply was lost', async () => {
    const pending = await seedPending()
    expect(await approveSubmission(pending.id)).toEqual({ success: true })
    expect(await activeNotes(pending.id)).toBe(1)
    mockRefundsCreate.mockResolvedValueOnce({ id: 're_lost_reply', amount: 2495 })
    afterWrite.throwOnce = 'recordRefund'

    expect(
      await changeSubmissionStatus(pending.id, SubmissionStatus.DENIED, {
        reason: 'Legal',
        note: null,
      })
    ).toEqual({
      success: true,
    })
    const row = await reload(pending.id)
    expect(row).toMatchObject({ status: SubmissionStatus.DENIED, stripeRefundId: 're_lost_reply' })
    expect(row.denialEmailSentAt).not.toBeNull()
    expect(await activeNotes(pending.id)).toBe(0)
    expect(mockSendDenialEmail).toHaveBeenCalledExactlyOnceWith(DENIAL_EMAIL)
  })

  it('fails instead of reporting a record when a concurrent settlement released the row first', async () => {
    const pending = await seedPending()
    mockRefundsCreate.mockRejectedValueOnce(new Error('socket hang up'))
    await denySubmission(pending.id, { reason: 'Legal', note: null })
    mockRefundsList.mockImplementationOnce(async (params) => {
      expect(await settleRefundReservation(pending.id, SubmissionStatus.MAYBE)).toEqual({
        settled: 'released',
        status: SubmissionStatus.MAYBE,
      })
      stripeRefunds.push(dashboardRefund(pending))
      return listRefunds(params)
    })

    await expect(settleRefundReservation(pending.id, undefined)).rejects.toThrow(
      'Refund re_dashboard was issued but could not be recorded.'
    )
    expect(await reload(pending.id)).toMatchObject({
      status: SubmissionStatus.MAYBE,
      stripeRefundId: null,
    })
    expect(mockSendDenialEmail).not.toHaveBeenCalled()
  })

  it('fails instead of reporting a release when a concurrent settlement released the row first', async () => {
    const pending = await seedPending()
    mockRefundsCreate.mockRejectedValueOnce(new Error('socket hang up'))
    await denySubmission(pending.id, { reason: 'Legal', note: null })
    mockRefundsList.mockImplementationOnce(async (params) => {
      expect(await settleRefundReservation(pending.id, SubmissionStatus.PENDING_REVIEW)).toEqual({
        settled: 'released',
        status: SubmissionStatus.PENDING_REVIEW,
      })
      return listRefunds(params)
    })

    await expect(settleRefundReservation(pending.id, SubmissionStatus.MAYBE)).rejects.toThrow(
      'release refused: stale'
    )
    expect(await reload(pending.id)).toMatchObject({
      status: SubmissionStatus.PENDING_REVIEW,
      stripeRefundId: null,
    })
  })

  it('reports a denial email that failed during settlement and still records the refund and revokes the note', async () => {
    const approved = await approvedThenRefundedInStripe()
    await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, {
      reason: 'Legal',
      note: null,
    })
    mockSendDenialEmail.mockRejectedValueOnce(new Error('resend down'))

    const settled = await settleRefundReservation(approved.id, undefined)
    expect(settled).toEqual({
      settled: 'recorded',
      refundId: 're_dashboard',
      notice: {
        success: true,
        warning: 'Submission denied, but email notification failed to send',
      },
    })
    const row = await reload(approved.id)
    expect(row).toMatchObject({ stripeRefundId: 're_dashboard', denialEmailSentAt: null })
    expect(await activeNotes(approved.id)).toBe(0)
  })

  it('refuses to release while Stripe lists only failed, canceled or unreadable refunds', async () => {
    const approved = await approvedThenRefundedInStripe()
    await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, {
      reason: 'Legal',
      note: null,
    })
    const reserved = await reload(approved.id)
    stripeRefunds.splice(
      0,
      stripeRefunds.length,
      { ...dashboardRefund(approved), id: 're_failed', status: 'failed' },
      { ...dashboardRefund(approved), id: 're_odd', status: null }
    )

    await expect(settleRefundReservation(approved.id, SubmissionStatus.MAYBE)).rejects.toThrow(
      'no settled refund for pi_'
    )
    expect(await reload(approved.id)).toEqual(reserved)
    expect(mockSendDenialEmail).not.toHaveBeenCalled()
  })

  it.each(RELEASE_TARGETS)(
    'releases a reservation to %s only when Stripe holds no refund for the payment intent and a status is given',
    async (target) => {
      const pending = await seedPending()
      mockRefundsCreate.mockRejectedValueOnce(new Error('socket hang up'))
      await denySubmission(pending.id, { reason: 'Other', note: 'no answer' })
      const reserved = await reload(pending.id)
      expect(reserved).toMatchObject({
        stripeRefundId: `pending_${pending.id}`,
        denialReason: 'Other',
        denialNote: 'no answer',
      })

      await expect(settleRefundReservation(pending.id, undefined)).rejects.toThrow(
        `rerun with --release-to <${RELEASE_TARGETS.join('|')}> to release the reservation`
      )
      expect(await reload(pending.id)).toEqual(reserved)

      expect(await settleRefundReservation(pending.id, target)).toEqual({
        settled: 'released',
        status: target,
      })
      expect(await reload(pending.id)).toEqual({
        ...reserved,
        status: target,
        stripeRefundId: null,
        denialReason: null,
        denialNote: null,
        reviewedByAdminId: null,
        reviewedAt: null,
        updatedAt: expect.any(Date),
      })
      expect(mockSendDenialEmail).not.toHaveBeenCalled()
    }
  )

  it.each([SubmissionStatus.DENIED, 'SHIPPED'])(
    'refuses to release a reservation to %s, which no deny could have started from',
    async (target) => {
      const pending = await seedPending()
      mockRefundsCreate.mockRejectedValueOnce(new Error('socket hang up'))
      await denySubmission(pending.id, { reason: 'Legal', note: null })
      const reserved = await reload(pending.id)

      await expect(settleRefundReservation(pending.id, target)).rejects.toThrow(
        `${target} is not a status a refund reservation can be released to; use one of PENDING_REVIEW, MAYBE, MANUAL, APPROVED`
      )
      expect(await reload(pending.id)).toEqual(reserved)
      expect(await approveSubmission(pending.id)).toMatchObject({ success: false })
    }
  )
})

describe('the detail-page deny', () => {
  it('settles an APPROVED row the old bug left refunded without a second refund, revoking its note and emailing', async () => {
    const legacy = await seedSubmission(
      { status: SubmissionStatus.APPROVED, refund: 'refunded' },
      { paymentAmount: 2495 }
    )
    await createNoteVerification(legacy, new Date('2026-03-05T00:00:00.000Z'))
    expect(await activeNotes(legacy.id)).toBe(1)

    expect(
      await changeSubmissionStatus(legacy.id, SubmissionStatus.DENIED, {
        reason: 'Legal',
        note: null,
      })
    ).toEqual({
      success: true,
    })
    expect(mockRefundsCreate).not.toHaveBeenCalled()
    expect(await reload(legacy.id)).toMatchObject({
      status: SubmissionStatus.DENIED,
      denialReason: 'Legal',
      stripeRefundId: legacy.stripeRefundId,
      refundedAt: legacy.refundedAt,
      reviewedByAdminId: adminId,
    })
    expect(await activeNotes(legacy.id)).toBe(0)
    expect(mockSendDenialEmail).toHaveBeenCalledExactlyOnceWith(DENIAL_EMAIL)
  })

  it('refunds an APPROVED row under its own idempotency key and origin', async () => {
    const pending = await seedPending()
    expect(await approveSubmission(pending.id)).toEqual({ success: true })
    mockRefundsCreate.mockResolvedValueOnce({ id: 're_override', amount: 2495 })

    expect(
      await changeSubmissionStatus(pending.id, SubmissionStatus.DENIED, {
        reason: 'Legal',
        note: null,
      })
    ).toEqual({
      success: true,
    })
    expect(mockRefundsCreate).toHaveBeenCalledExactlyOnceWith(
      {
        payment_intent: pending.stripePaymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          submissionId: pending.id,
          denialReason: 'Legal',
          processedBy: 'admin-status-change',
        },
      },
      { idempotencyKey: `refund_${pending.id}_${adminId}_change` }
    )
    expect(await reload(pending.id)).toMatchObject({
      status: SubmissionStatus.DENIED,
      stripeRefundId: 're_override',
    })
    expect(await activeNotes(pending.id)).toBe(0)
    expect(mockSendDenialEmail).toHaveBeenCalledExactlyOnceWith(DENIAL_EMAIL)
  })

  it('refuses APPROVED and an unknown target status without touching the row', async () => {
    const pending = await seedPending()

    expect(await changeSubmissionStatus(pending.id, 'APPROVED' as never)).toEqual({
      success: false,
      error: 'Cannot change submission to status: APPROVED',
    })
    expect(await changeSubmissionStatus(pending.id, 'SHIPPED' as never)).toEqual({
      success: false,
      error: 'Cannot change submission to status: SHIPPED',
    })
    expect(
      await changeSubmissionStatus(pending.id, ['DENIED'] as never, { reason: 'Legal', note: null })
    ).toEqual({
      success: false,
      error: 'Cannot change submission to status: ["DENIED"]',
    })
    expect(await reload(pending.id)).toEqual(pending)
  })
})

describe('marking manual', () => {
  it('the queue marks only a MAYBE row manual, and the detail page marks a PENDING_REVIEW row', async () => {
    const pending = await seedPending()
    expect(await markAsManual(pending.id)).toEqual({
      success: false,
      error: 'Cannot change submission with status: PENDING_REVIEW',
    })
    expect(await reload(pending.id)).toEqual(pending)

    expect(await maybeSubmission(pending.id, { reason: 'OTHER_REVIEW' })).toMatchObject({
      success: true,
    })
    expect(await markAsManual(pending.id)).toEqual({ success: true })
    expect(await reload(pending.id)).toMatchObject({
      status: SubmissionStatus.MANUAL,
      reviewedByAdminId: adminId,
    })

    const other = await seedPending()
    expect(await changeSubmissionStatus(other.id, SubmissionStatus.MANUAL)).toEqual({
      success: true,
    })
    expect(await reload(other.id)).toMatchObject({ status: SubmissionStatus.MANUAL })
  })
})

describe('a row that moves between the read and the write', () => {
  const legal = (id: string) => denySubmission(id, { reason: 'Legal', note: null })
  const approve = (id: string) => approveSubmission(id)
  const overrideDeny = (id: string) =>
    changeSubmissionStatus(id, SubmissionStatus.DENIED, { reason: 'Legal', note: null })
  const races: {
    name: string
    start: Parameters<typeof seedSubmission>[0]
    act: (id: string) => Promise<ActionResult>
    competitor: (id: string) => Promise<ActionResult>
    after: SubmissionStatus
    refunds: number
  }[] = [
    {
      name: 'the queue deny of a MANUAL row, after another admin approved it',
      start: { status: SubmissionStatus.MANUAL, refund: 'none' },
      act: legal,
      competitor: approve,
      after: SubmissionStatus.APPROVED,
      refunds: 0,
    },
    {
      name: 'the manual approval, after another admin denied it',
      start: { status: SubmissionStatus.MANUAL, refund: 'none' },
      act: approve,
      competitor: legal,
      after: SubmissionStatus.DENIED,
      refunds: 0,
    },
    {
      name: 'the queue deny with a refund, after another admin approved it',
      start: { status: SubmissionStatus.PENDING_REVIEW, refund: 'none' },
      act: legal,
      competitor: approve,
      after: SubmissionStatus.APPROVED,
      refunds: 0,
    },
    {
      name: 'the detail-page deny of a refunded APPROVED row, after another admin denied it',
      start: { status: SubmissionStatus.APPROVED, refund: 'refunded' },
      act: overrideDeny,
      competitor: overrideDeny,
      after: SubmissionStatus.DENIED,
      refunds: 0,
    },
    {
      name: 'the detail-page manual, after another admin approved it',
      start: { status: SubmissionStatus.PENDING_REVIEW, refund: 'none' },
      act: (id) => changeSubmissionStatus(id, SubmissionStatus.MANUAL),
      competitor: approve,
      after: SubmissionStatus.APPROVED,
      refunds: 0,
    },
    {
      name: 'the reopen of a MAYBE row, after another admin marked it manual',
      start: { status: SubmissionStatus.MAYBE, refund: 'none' },
      act: (id) => changeSubmissionStatus(id, SubmissionStatus.PENDING_REVIEW),
      competitor: markAsManual,
      after: SubmissionStatus.MANUAL,
      refunds: 0,
    },
    {
      name: 'the queue manual of a MAYBE row, after another admin approved it',
      start: { status: SubmissionStatus.MAYBE, refund: 'none' },
      act: markAsManual,
      competitor: approve,
      after: SubmissionStatus.APPROVED,
      refunds: 0,
    },
    {
      name: 'the queue maybe, after another admin approved it',
      start: { status: SubmissionStatus.PENDING_REVIEW, refund: 'none' },
      act: (id) => maybeSubmission(id, { reason: 'OTHER_REVIEW' }),
      competitor: approve,
      after: SubmissionStatus.APPROVED,
      refunds: 0,
    },
    {
      name: 'the re-approval, after another admin denied and refunded it',
      start: { status: SubmissionStatus.APPROVED, refund: 'none' },
      act: reApproveSubmission,
      competitor: overrideDeny,
      after: SubmissionStatus.DENIED,
      refunds: 1,
    },
  ]

  it.each(races)('$name refuses as stale and keeps the other write', async (race) => {
    const row = await seedSubmission(race.start, { paymentAmount: 2495 })
    mockRefundsCreate.mockResolvedValue({ id: 're_race', amount: 2495 })
    betweenReadAndWrite.run = async () => {
      expect(await race.competitor(row.id)).toMatchObject({ success: true })
    }

    expect(await race.act(row.id)).toEqual({ success: false, error: STALE })
    expect(betweenReadAndWrite.run).toBeNull()
    expect(await reload(row.id)).toMatchObject({ status: race.after })
    expect(mockRefundsCreate).toHaveBeenCalledTimes(race.refunds)
  })
})

describe('the queue deny', () => {
  it('emails the address the row has after the refund is recorded, not the one read before Stripe', async () => {
    const pending = await seedPending()
    mockRefundsCreate.mockImplementationOnce(async () => {
      await updateSubmissionDetails(pending.id, { email: 'moved@example.com' }, new Date())
      return { id: 're_moved', amount: 2495 }
    })

    expect(await denySubmission(pending.id, { reason: 'Legal', note: null })).toEqual({
      success: true,
    })
    expect(await reload(pending.id)).toMatchObject({
      status: SubmissionStatus.DENIED,
      stripeRefundId: 're_moved',
      email: 'moved@example.com',
    })
    expect(mockSendDenialEmail).toHaveBeenCalledExactlyOnceWith({
      ...DENIAL_EMAIL,
      to: 'moved@example.com',
    })
  })

  it('of a MANUAL row attempts no refund and sends no email', async () => {
    const manual = await seedSubmission({ status: SubmissionStatus.MANUAL, refund: 'none' })

    expect(await denySubmission(manual.id, { reason: 'Legal', note: null })).toEqual({
      success: true,
    })
    expect(await reload(manual.id)).toMatchObject({
      status: SubmissionStatus.DENIED,
      denialReason: 'Legal',
      stripeRefundId: null,
      denialEmailSentAt: null,
    })
    expect(mockRefundsCreate).not.toHaveBeenCalled()
    expect(mockSendDenialEmail).not.toHaveBeenCalled()
  })
})

describe('the detail-page override', () => {
  it.each([
    [SubmissionStatus.MAYBE, { reason: 'OTHER_REVIEW' }],
    [SubmissionStatus.MANUAL, undefined],
    [SubmissionStatus.PENDING_REVIEW, undefined],
  ])('moving an approved row to %s revokes its note', async (target, input) => {
    const pending = await seedPending()
    expect(await approveSubmission(pending.id)).toEqual({ success: true })

    expect(await changeSubmissionStatus(pending.id, target, undefined, input)).toEqual({
      success: true,
    })
    expect(await reload(pending.id)).toMatchObject({ status: target })
    expect(await activeNotes(pending.id)).toBe(0)
  })

  it('keeps the note when the move to MAYBE is refused for its reason', async () => {
    const pending = await seedPending()
    expect(await approveSubmission(pending.id)).toEqual({ success: true })

    expect(
      await changeSubmissionStatus(pending.id, SubmissionStatus.MAYBE, undefined, {
        reason: 'BOGUS',
      })
    ).toEqual({ success: false, error: 'Invalid maybe reason' })
    expect(await reload(pending.id)).toMatchObject({ status: SubmissionStatus.APPROVED })
    expect(await activeNotes(pending.id)).toBe(1)
  })

  it('requires a denial reason and refuses to reopen a row still in review, each with its own message', async () => {
    const pending = await seedPending()

    expect(await changeSubmissionStatus(pending.id, SubmissionStatus.DENIED)).toEqual({
      success: false,
      error: 'Denial reason is required',
    })
    expect(await changeSubmissionStatus(pending.id, SubmissionStatus.PENDING_REVIEW)).toEqual({
      success: false,
      error: 'Cannot change submission with status: PENDING_REVIEW',
    })
    expect(await reload(pending.id)).toEqual(pending)
  })
})

describe('the approval', () => {
  it('records no restrictions and a null diagnosis for an empty one', async () => {
    const pending = await seedPending()

    expect(await approveSubmission(pending.id, undefined, '', false)).toEqual({ success: true })
    expect(await reload(pending.id)).toMatchObject({
      status: SubmissionStatus.APPROVED,
      approvalWithRestrictions: false,
      approvalDiagnosis: null,
    })
  })

  it('emails the address the row has after the write, not the one read before the PDF', async () => {
    const pending = await seedPending()
    mockGenerateDoctorNotePDF.mockImplementationOnce(async () => {
      await updateSubmissionDetails(pending.id, { email: 'moved@example.com' }, new Date())
      return Buffer.from('pdf')
    })

    expect(await approveSubmission(pending.id)).toEqual({ success: true })
    expect(mockSendApprovalEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ to: 'moved@example.com' })
    )
    expect(mockSendSms).toHaveBeenCalledExactlyOnceWith({
      submission: expect.objectContaining({ email: 'moved@example.com' }),
      type: 'APPROVAL_SENT',
      body: expect.any(String),
    })
  })

  it('leaves the row pending with no active note when the PDF fails', async () => {
    const pending = await seedPending()
    mockGenerateDoctorNotePDF.mockRejectedValueOnce(new Error('renderer down'))

    expect(await approveSubmission(pending.id)).toEqual({
      success: false,
      error: 'Failed to generate PDF: renderer down',
    })
    expect(await reload(pending.id)).toEqual(pending)
    expect(await activeNotes(pending.id)).toBe(0)
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
  })

  it('re-approval refuses a row still in review with its own verb, and reports its own email failure', async () => {
    const pending = await seedPending()
    expect(await reApproveSubmission(pending.id)).toEqual({
      success: false,
      error: 'Cannot re-approve submission with status: PENDING_REVIEW',
    })

    expect(await approveSubmission(pending.id)).toEqual({ success: true })
    mockSendApprovalEmail.mockRejectedValueOnce(new Error('resend down'))
    expect(await reApproveSubmission(pending.id)).toEqual({
      success: true,
      warning: 'Re-approval processed, but email notification failed to send',
    })
  })

  it('re-approval revokes the earlier note and leaves the new one active', async () => {
    const pending = await seedPending()
    expect(await approveSubmission(pending.id)).toEqual({ success: true })
    const first = (await findSubmissionForAdminDetail(pending.id))?.noteVerifications[0]
    if (!first) throw new Error('approval issued no note')

    expect(await reApproveSubmission(pending.id)).toEqual({ success: true })
    expect(await findNoteVerificationBySlug(first.verificationSlug)).toMatchObject({
      status: 'REVOKED',
    })
    const current = (await findSubmissionForAdminDetail(pending.id))?.noteVerifications[0]
    expect(current?.id).not.toBe(first.id)
    expect(mockSendApprovalEmail).toHaveBeenCalledTimes(2)
  })
})
