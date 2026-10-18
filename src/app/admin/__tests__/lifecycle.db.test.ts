import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession, mockRefundsCreate, mockSendApprovalEmail } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRefundsCreate: vi.fn(),
  mockSendApprovalEmail: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendApprovalEmail: mockSendApprovalEmail,
  sendDenialEmail: vi.fn(),
  sendMaybeEmail: vi.fn(),
}))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: mockRefundsCreate } } }))
vi.mock('@/lib/pdf/generate-pdf', () => ({
  generateDoctorNotePDF: vi.fn(async () => Buffer.from('pdf')),
  generatePDFFilename: vi.fn(() => 'note.pdf'),
}))
vi.mock('@/lib/qr-code', () => ({
  generateQrCodeDataUrl: vi.fn(async () => 'data:image/png;base64,'),
}))

import { approveSubmission } from '@/app/admin/_actions/approve'
import { changeSubmissionStatus } from '@/app/admin/_actions/change-status'
import { denySubmission } from '@/app/admin/_actions/deny'
import { maybeSubmission } from '@/app/admin/_actions/maybe'
import { createVerifiedUser } from '@/db/auth'
import { findSubmissionById, insertSubmission } from '@/db/submissions'
import { SubmissionStatus, type Submission } from '@/db/types'

let adminId: string

beforeEach(async () => {
  vi.clearAllMocks()
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

async function seedRefundedDenied(): Promise<Submission> {
  const pending = await seedPending()
  mockRefundsCreate.mockResolvedValueOnce({ id: 're_done', amount: 2495 })
  const denied = await denySubmission(pending.id, 'Legal')
  expect(denied).toEqual({ success: true })
  const row = await reload(pending.id)
  expect(row).toMatchObject({ status: SubmissionStatus.DENIED, stripeRefundId: 're_done' })
  return row
}

describe('live bug 1: a refunded customer must never be approved', () => {
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

describe('live bug 6: a failed refund restores the prior status', () => {
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

    mockRefundsCreate.mockRejectedValueOnce(new Error('card declined'))
    const denied = await denySubmission(pending.id, 'Legal')
    expect(denied.success).toBe(false)
    expect(denied.error).toContain('card declined')

    const after = await reload(pending.id)
    expect(after).toEqual({ ...before, updatedAt: after.updatedAt })
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime())
  })
})
