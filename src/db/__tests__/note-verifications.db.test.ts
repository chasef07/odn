import { describe, expect, it } from 'vitest'
import {
  createNoteVerificationWithUniqueIdentifiers,
  findNoteVerificationByMedicalRecordNumber,
  findNoteVerificationBySlug,
  revokeNoteVerificationById,
  revokeNoteVerificationForSubmission,
  revokeOtherNoteVerificationsForSubmission,
  type NewNoteVerification,
} from '../note-verifications'
import { db } from '../pool'
import { count, sql } from '../sql'
import { insert, select } from '../table'
import { noteVerifications, submissions } from '../tables'
import type { NoteVerification } from '../types'

const seededAt = new Date('2026-01-01T00:00:00.000Z')
const revokedAt = new Date('2026-04-07T15:30:00.000Z')

async function seedSubmission(
  id: string,
  state: { status?: 'APPROVED' | 'DENIED'; refundedAt?: Date | null } = {}
) {
  await db.affected(
    sql`${insert(submissions, {
      id,
      stripePaymentIntentId: `pi_${id}`,
      status: state.status ?? 'APPROVED',
      refundedAt: state.refundedAt ?? null,
      state: 'CA',
      recipient: 'Employer',
      patientFirstName: 'Jane',
      patientLastName: 'Doe',
      patientDateOfBirth: new Date('1990-05-01T00:00:00.000Z'),
      email: 'jane@example.com',
      phone: '5555550100',
      notePurpose: 'work',
      firstDayOff: new Date('2026-04-01T00:00:00.000Z'),
      lastDayOff: new Date('2026-04-04T00:00:00.000Z'),
      absenceReason: 'illness',
    })}`
  )
}

function newVerification(suffix: string, submissionId = 'sub_1'): NewNoteVerification {
  return {
    submissionId,
    medicalRecordNumber: `MRN${suffix}`,
    verificationSlug: `v_slug_${suffix}`,
    issueDate: new Date('2026-04-06T00:00:00.000Z'),
    patientInitials: 'J.D.',
    firstDayOff: new Date('2026-04-01T00:00:00.000Z'),
    lastDayOff: new Date('2026-04-04T00:00:00.000Z'),
    returnGuidance: 'May return after April 4, 2026',
    physicianName: 'Dr. Test',
    physicianCredentials: 'MD',
    physicianNpi: '1234567890',
    licenseState: 'California',
    licenseNumber: 'A12345',
  }
}

async function seedVerification(
  id: string,
  submissionId: string,
  state: Partial<Pick<NoteVerification, 'status' | 'revokedAt'>> = {}
) {
  await db.affected(
    sql`${insert(noteVerifications, {
      ...newVerification(id, submissionId),
      id,
      status: state.status ?? 'ACTIVE',
      revokedAt: state.revokedAt ?? null,
      createdAt: seededAt,
      updatedAt: seededAt,
    })}`
  )
}

async function revocationState() {
  const rows = await db.rows(
    sql`SELECT ${select(noteVerifications, ['id', 'status', 'revokedAt', 'updatedAt'])} FROM note_verifications ORDER BY id`
  )
  return Object.fromEntries(rows.map(({ id, ...state }) => [id, state]))
}

async function verificationCount() {
  return (await db.one(sql`SELECT ${count('n')} FROM note_verifications`))?.n
}

const untouched = { status: 'ACTIVE', revokedAt: null, updatedAt: seededAt }
const revokedNow = { status: 'REVOKED', revokedAt, updatedAt: expect.any(Date) }

describe('createNoteVerificationWithUniqueIdentifiers', () => {
  it('creates the verification and returns the full row with generated id and timestamps', async () => {
    await seedSubmission('sub_1')

    const created = await createNoteVerificationWithUniqueIdentifiers(() => newVerification('1'), 5)

    expect(created).toEqual({
      ...newVerification('1'),
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      status: 'ACTIVE',
      revokedAt: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
    const stored = await db.one(
      sql`SELECT ${select(noteVerifications, ['id'])} FROM note_verifications WHERE medical_record_number = ${'MRN1'}`
    )
    expect(stored).toEqual({ id: created.id })
  })

  it.each([
    ['medical record number', { medicalRecordNumber: 'MRNtaken' }],
    ['verification slug', { verificationSlug: 'v_slug_taken' }],
  ])('retries with fresh identifiers after a %s collision', async (_column, collision) => {
    await seedSubmission('sub_1')
    await seedVerification('taken', 'sub_1')
    const builds: NewNoteVerification[] = [
      { ...newVerification('first'), ...collision },
      newVerification('second'),
    ]
    let calls = 0

    const created = await createNoteVerificationWithUniqueIdentifiers(() => builds[calls++], 5)

    expect(calls).toBe(2)
    expect(created).toMatchObject(newVerification('second'))
    expect(await verificationCount()).toBe(2)
  })

  it('gives up after maxAttempts collisions with the same error', async () => {
    await seedSubmission('sub_1')
    await seedVerification('taken', 'sub_1')
    let calls = 0

    await expect(
      createNoteVerificationWithUniqueIdentifiers(() => {
        calls++
        return { ...newVerification(`try${calls}`), medicalRecordNumber: 'MRNtaken' }
      }, 3)
    ).rejects.toThrow('Failed to create a unique note verification record')
    expect(calls).toBe(3)
    expect(await verificationCount()).toBe(1)
  })

  it('rethrows other errors without retrying', async () => {
    let calls = 0

    await expect(
      createNoteVerificationWithUniqueIdentifiers(() => {
        calls++
        return newVerification('1', 'missing_submission')
      }, 5)
    ).rejects.toThrow(/foreign key/)
    expect(calls).toBe(1)
  })
})

describe('note verification lookups', () => {
  const refundedAt = new Date('2026-04-08T12:00:00.000Z')

  async function seedTwoParents() {
    await seedSubmission('sub_1', { status: 'DENIED', refundedAt })
    await seedSubmission('sub_2', { status: 'APPROVED', refundedAt: null })
    await seedVerification('1', 'sub_1', { status: 'REVOKED', revokedAt })
    await seedVerification('2', 'sub_2')
  }

  function picked(suffix: string) {
    const {
      submissionId: _submissionId,
      verificationSlug: _verificationSlug,
      ...rest
    } = newVerification(suffix)
    return rest
  }

  it('finds each verification by slug with its own parent submission state', async () => {
    await seedTwoParents()

    expect(await findNoteVerificationBySlug('v_slug_1')).toEqual({
      ...picked('1'),
      status: 'REVOKED',
      revokedAt,
      submission: { status: 'DENIED', refundedAt },
    })
    expect(await findNoteVerificationBySlug('v_slug_2')).toEqual({
      ...picked('2'),
      status: 'ACTIVE',
      revokedAt: null,
      submission: { status: 'APPROVED', refundedAt: null },
    })
    expect(await findNoteVerificationBySlug('v_slug_missing')).toBeNull()
  })

  it('finds each verification by medical record number with its own parent submission state', async () => {
    await seedTwoParents()

    expect(await findNoteVerificationByMedicalRecordNumber('MRN1')).toEqual({
      verificationSlug: 'v_slug_1',
      status: 'REVOKED',
      revokedAt,
      submission: { status: 'DENIED', refundedAt },
    })
    expect(await findNoteVerificationByMedicalRecordNumber('MRN2')).toEqual({
      verificationSlug: 'v_slug_2',
      status: 'ACTIVE',
      revokedAt: null,
      submission: { status: 'APPROVED', refundedAt: null },
    })
    expect(await findNoteVerificationByMedicalRecordNumber('MRNmissing')).toBeNull()
  })
})

describe('note verification revocation', () => {
  const earlier = new Date('2026-03-01T00:00:00.000Z')

  async function seedFleet() {
    await seedSubmission('sub_1')
    await seedSubmission('sub_2')
    await seedVerification('a_active', 'sub_1')
    await seedVerification('b_active', 'sub_1')
    await seedVerification('c_revoked', 'sub_1', { status: 'REVOKED' })
    await seedVerification('d_stamped', 'sub_1', { revokedAt: earlier })
    await seedVerification('e_other', 'sub_2')
  }

  const stale = {
    c_revoked: { status: 'REVOKED', revokedAt: null, updatedAt: seededAt },
    d_stamped: { status: 'ACTIVE', revokedAt: earlier, updatedAt: seededAt },
  }

  it('revokes one active verification by id', async () => {
    await seedFleet()

    await revokeNoteVerificationById('a_active', revokedAt)
    await revokeNoteVerificationById('c_revoked', revokedAt)
    await revokeNoteVerificationById('d_stamped', revokedAt)

    const state = await revocationState()
    expect(state).toEqual({
      a_active: revokedNow,
      b_active: untouched,
      ...stale,
      e_other: untouched,
    })
    expect(state.a_active.updatedAt.getTime()).toBeGreaterThan(seededAt.getTime())
  })

  it('revokes the other active verifications for a submission', async () => {
    await seedFleet()

    await revokeOtherNoteVerificationsForSubmission('sub_1', 'b_active', revokedAt)

    const state = await revocationState()
    expect(state).toEqual({
      a_active: revokedNow,
      b_active: untouched,
      ...stale,
      e_other: untouched,
    })
    expect(state.a_active.updatedAt.getTime()).toBeGreaterThan(seededAt.getTime())
  })

  it('revokes every active verification for a submission', async () => {
    await seedFleet()

    await revokeNoteVerificationForSubmission('sub_1', revokedAt)

    const state = await revocationState()
    expect(state).toEqual({
      a_active: revokedNow,
      b_active: revokedNow,
      ...stale,
      e_other: untouched,
    })
    expect(state.b_active.updatedAt.getTime()).toBeGreaterThan(seededAt.getTime())
  })
})
