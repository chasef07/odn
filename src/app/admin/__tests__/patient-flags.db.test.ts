import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))

import {
  clearPatientFlag,
  getPatientFlag,
  setPatientFlag,
} from '@/app/admin/_actions/patient-flags'
import { seedSubmission } from '@/db/__tests__/seed'
import { SubmissionStatus } from '@/db/types'

const pending = { status: SubmissionStatus.PENDING_REVIEW, refund: 'none' } as const

beforeEach(() => {
  mockGetSession.mockResolvedValue({
    user: { id: 'admin-1', email: 'doctor@example.test', emailVerified: true },
  })
})

describe('patient flags', () => {
  it('shows a flag set on one submission on a later submission for the same patient, and not for a different patient', async () => {
    const first = await seedSubmission(
      { status: SubmissionStatus.APPROVED, refund: 'none' },
      { createdAt: new Date('2026-10-01T12:00:00.000Z') }
    )
    const later = await seedSubmission(pending, {
      patientFirstName: 'JOHN',
      patientLastName: 'doe',
      email: 'new-address@example.com',
      createdAt: new Date('2026-11-14T12:00:00.000Z'),
    })
    const otherPatient = await seedSubmission(pending, {
      patientDateOfBirth: new Date('1991-05-15T00:00:00.000Z'),
    })

    const before = Date.now()
    const flagged = await setPatientFlag(first.id, '  Asked for back-dated notes twice  ')

    expect(flagged).toEqual({
      success: true,
      flag: {
        id: expect.any(String),
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientDateOfBirth: first.patientDateOfBirth,
        reason: 'Asked for back-dated notes twice',
        flaggedBy: 'doctor@example.test',
        flaggedAt: expect.any(Date),
      },
    })
    if (!flagged.success || !flagged.flag) throw new Error('expected a flag')
    expect(flagged.flag.flaggedAt.getTime()).toBeGreaterThanOrEqual(before - 1000)

    expect(await getPatientFlag(later.id)).toEqual(flagged)
    expect(await getPatientFlag(otherPatient.id)).toEqual({ success: true, flag: null })
  })

  it('stores a blank reason as no reason', async () => {
    const submission = await seedSubmission(pending)

    expect(await setPatientFlag(submission.id, '   ')).toEqual({
      success: true,
      flag: expect.objectContaining({ reason: null }),
    })
  })

  it('refuses a reason over 500 characters and stores nothing', async () => {
    const submission = await seedSubmission(pending)

    expect(await setPatientFlag(submission.id, 'x'.repeat(501))).toEqual({
      success: false,
      error: 'Keep the reason to 500 characters or fewer',
    })
    expect(await getPatientFlag(submission.id)).toEqual({ success: true, flag: null })
  })

  it('unflagging from any of the patient’s submissions clears the flag on all of them', async () => {
    const first = await seedSubmission(pending)
    const later = await seedSubmission(pending)
    await setPatientFlag(first.id, '')

    expect(await clearPatientFlag(later.id)).toEqual({ success: true, flag: null })

    expect(await getPatientFlag(first.id)).toEqual({ success: true, flag: null })
  })

  it('reports a submission that does not exist', async () => {
    const missing = { success: false, error: 'Submission not found' }

    expect(await getPatientFlag('missing')).toEqual(missing)
    expect(await setPatientFlag('missing', 'x')).toEqual(missing)
    expect(await clearPatientFlag('missing')).toEqual(missing)
  })
})
