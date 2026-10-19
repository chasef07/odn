import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetSession,
  mockRefundsCreate,
  mockRefundsList,
  mockSendApprovalEmail,
  mockSendDenialEmail,
  mockGenerateDoctorNotePDF,
  betweenReadAndWrite,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRefundsCreate: vi.fn(),
  mockRefundsList: vi.fn(),
  mockSendApprovalEmail: vi.fn(),
  mockSendDenialEmail: vi.fn(),
  mockGenerateDoctorNotePDF: vi.fn(async () => Buffer.from('pdf')),
  betweenReadAndWrite: { run: null as null | (() => Promise<void>) },
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendApprovalEmail: mockSendApprovalEmail,
  sendDenialEmail: mockSendDenialEmail,
  sendMaybeEmail: vi.fn(),
}))
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
  return { ...actual, permit }
})

import { approveSubmission, reApproveSubmission } from '@/app/admin/_actions/approve'
import { changeSubmissionStatus } from '@/app/admin/_actions/change-status'
import { denySubmission } from '@/app/admin/_actions/deny'
import { markAsManual, maybeSubmission } from '@/app/admin/_actions/maybe'
import { settleRefundReservation } from '@/app/admin/_actions/shared'
import { seedSubmission } from '@/db/__tests__/seed'
import { createVerifiedUser } from '@/db/auth'
import { findNoteVerificationBySlug } from '@/db/note-verifications'
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

function stripeError(type: string, message: string, code?: string): Error {
  return Object.assign(new Error(message), { type, code })
}

beforeEach(async () => {
  vi.resetAllMocks()
  betweenReadAndWrite.run = null
  mockRefundsList.mockResolvedValue({ data: [] })
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
  const denied = await denySubmission(pending.id, 'Legal')
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
    expect(moved.success).toBe(false)
    expect(await reload(refunded.id)).toEqual(refunded)

    const approved = await approveSubmission(refunded.id)
    expect(approved.success).toBe(false)
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(await reload(refunded.id)).toEqual(refunded)
  })

  it('refuses the override to MANUAL and the manual approval of a refunded denied submission', async () => {
    const refunded = await seedRefundedDenied()

    const moved = await changeSubmissionStatus(refunded.id, SubmissionStatus.MANUAL)
    expect(moved.success).toBe(false)
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
      internalNote: 'check the dates',
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
    const denied = await denySubmission(pending.id, 'Legal')
    expect(denied.success).toBe(false)
    expect(denied.error).toContain('card declined')

    const after = await reload(pending.id)
    expect(after).toEqual({ ...before, updatedAt: after.updatedAt })
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime())
  })

  it('keeps the row denied with its refund pending when the Stripe outcome is unknown, and refuses every later action', async () => {
    const pending = await seedPending()
    mockRefundsCreate.mockRejectedValueOnce(new Error('socket hang up'))

    const denied = await denySubmission(pending.id, 'Legal')
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
    expect(await denySubmission(pending.id, 'Legal')).toMatchObject({ success: false })
    expect(mockSendApprovalEmail).not.toHaveBeenCalled()
    expect(await reload(pending.id)).toEqual(reserved)
  })
})

describe('a refund made in the Stripe dashboard', () => {
  const dashboardRefund = { id: 're_dashboard', amount: 2495, status: 'succeeded', metadata: {} }

  async function approvedThenRefundedInStripe(): Promise<Submission> {
    const pending = await seedPending()
    expect(await approveSubmission(pending.id)).toEqual({ success: true })
    expect(await activeNotes(pending.id)).toBe(1)
    mockRefundsList.mockResolvedValue({ data: [dashboardRefund] })
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

    const denied = await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, 'Legal')
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

  it('records the dashboard refund even when asked to release, revokes the note and sends the denial email', async () => {
    const approved = await approvedThenRefundedInStripe()
    await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, 'Legal')

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
      'holds no refund reservation'
    )
  })

  it('reports a denial email that failed during settlement and still records the refund and revokes the note', async () => {
    const approved = await approvedThenRefundedInStripe()
    await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, 'Legal')
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

  it('refuses to release while Stripe lists only failed or canceled refunds', async () => {
    const approved = await approvedThenRefundedInStripe()
    await changeSubmissionStatus(approved.id, SubmissionStatus.DENIED, 'Legal')
    const reserved = await reload(approved.id)
    mockRefundsList.mockResolvedValue({
      data: [{ ...dashboardRefund, id: 're_failed', status: 'failed' }],
    })

    await expect(settleRefundReservation(approved.id, SubmissionStatus.MAYBE)).rejects.toThrow(
      'only failed or canceled refunds'
    )
    expect(await reload(approved.id)).toEqual(reserved)
    expect(mockSendDenialEmail).not.toHaveBeenCalled()
  })

  it('releases a reservation only when Stripe holds no refund for the payment intent and a status is given', async () => {
    const pending = await seedPending()
    mockRefundsCreate.mockRejectedValueOnce(new Error('socket hang up'))
    await denySubmission(pending.id, 'Legal')
    const reserved = await reload(pending.id)
    expect(reserved.stripeRefundId).toBe(`pending_${pending.id}`)

    await expect(settleRefundReservation(pending.id, undefined)).rejects.toThrow(
      'rerun with --release-to'
    )
    expect(await reload(pending.id)).toEqual(reserved)

    expect(await settleRefundReservation(pending.id, SubmissionStatus.PENDING_REVIEW)).toEqual({
      settled: 'released',
      status: SubmissionStatus.PENDING_REVIEW,
    })
    expect(await reload(pending.id)).toMatchObject({
      status: SubmissionStatus.PENDING_REVIEW,
      stripeRefundId: null,
      denialReason: null,
      reviewedByAdminId: null,
    })
    expect(mockSendDenialEmail).not.toHaveBeenCalled()
  })
})

describe('the detail-page deny', () => {
  it('settles an APPROVED row the old bug left refunded without a second refund, revoking its note and emailing', async () => {
    const legacy = await seedSubmission(
      { status: SubmissionStatus.APPROVED, refund: 'refunded' },
      { paymentAmount: 2495 }
    )
    await createNoteVerification(legacy, new Date('2026-03-05T00:00:00.000Z'))
    expect(await activeNotes(legacy.id)).toBe(1)

    expect(await changeSubmissionStatus(legacy.id, SubmissionStatus.DENIED, 'Legal')).toEqual({
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

    expect(await changeSubmissionStatus(pending.id, SubmissionStatus.DENIED, 'Legal')).toEqual({
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
  it('the queue deny of a MANUAL row refuses after another admin approved it, and keeps the approval', async () => {
    const manual = await seedSubmission({ status: SubmissionStatus.MANUAL, refund: 'none' })
    betweenReadAndWrite.run = async () => {
      expect(await approveSubmission(manual.id)).toEqual({ success: true })
    }

    expect(await denySubmission(manual.id, 'Legal')).toEqual({ success: false, error: STALE })
    expect(await reload(manual.id)).toMatchObject({
      status: SubmissionStatus.APPROVED,
      denialReason: null,
    })
    expect(mockSendDenialEmail).not.toHaveBeenCalled()
  })

  it('the manual approval refuses after another admin denied it, and keeps the denial', async () => {
    const manual = await seedSubmission({ status: SubmissionStatus.MANUAL, refund: 'none' })
    betweenReadAndWrite.run = async () => {
      expect(await denySubmission(manual.id, 'Legal')).toEqual({ success: true })
    }

    expect(await approveSubmission(manual.id)).toEqual({ success: false, error: STALE })
    expect(await reload(manual.id)).toMatchObject({
      status: SubmissionStatus.DENIED,
      denialReason: 'Legal',
    })
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
