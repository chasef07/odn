import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFindUnique, mockCreate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
}))

vi.mock('../client', () => ({
  default: {
    noteVerification: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}))

import {
  createNoteVerificationWithUniqueIdentifiers,
  findNoteVerificationByMedicalRecordNumber,
  type NewNoteVerification,
} from '../note-verifications'

function buildVerification(attempt: number): NewNoteVerification {
  return {
    submissionId: 'sub_123',
    medicalRecordNumber: `A7B3C9D${attempt}`,
    verificationSlug: `v_slug_${attempt}`,
    issueDate: new Date(Date.UTC(2026, 3, 6)),
    patientInitials: 'J.D.',
    firstDayOff: new Date(Date.UTC(2026, 3, 1)),
    lastDayOff: new Date(Date.UTC(2026, 3, 4)),
    returnGuidance: 'May return after April 4, 2026',
    physicianName: 'Dr. Test',
    physicianCredentials: 'MD',
    physicianNpi: null,
    licenseState: null,
    licenseNumber: null,
  }
}

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

describe('note verification queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('looks up a verification by its Medical Record #', async () => {
    mockFindUnique.mockResolvedValue(null)

    await findNoteVerificationByMedicalRecordNumber('A7B3C9D2')

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { medicalRecordNumber: 'A7B3C9D2' },
      })
    )
  })

  it('retries with fresh identifiers after a unique constraint collision', async () => {
    let attempt = 0
    const created = { id: 'verification_123', ...buildVerification(1) }
    mockCreate.mockRejectedValueOnce(uniqueConstraintError()).mockResolvedValueOnce(created)

    const result = await createNoteVerificationWithUniqueIdentifiers(
      () => buildVerification(attempt++),
      5
    )

    expect(result).toBe(created)
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockCreate).toHaveBeenNthCalledWith(1, { data: buildVerification(0) })
    expect(mockCreate).toHaveBeenNthCalledWith(2, { data: buildVerification(1) })
  })

  it('rethrows the unique constraint error on the last attempt', async () => {
    const collision = uniqueConstraintError()
    mockCreate.mockRejectedValue(collision)

    await expect(
      createNoteVerificationWithUniqueIdentifiers(() => buildVerification(0), 2)
    ).rejects.toBe(collision)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('rethrows other errors without retrying', async () => {
    const failure = new Error('connection lost')
    mockCreate.mockRejectedValue(failure)

    await expect(
      createNoteVerificationWithUniqueIdentifiers(() => buildVerification(0), 5)
    ).rejects.toBe(failure)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })
})
