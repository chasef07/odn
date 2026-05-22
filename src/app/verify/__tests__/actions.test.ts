import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubmissionStatus } from '@prisma/client'

const { mockFindUnique, mockHeaders, mockRedirect } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockHeaders: vi.fn(),
  mockRedirect: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    noteVerification: {
      findUnique: mockFindUnique,
    },
  },
}))

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

import { lookupMedicalRecord } from '../actions'

function buildFormData(medicalRecordNumber: string) {
  const formData = new FormData()
  formData.set('medicalRecordNumber', medicalRecordNumber)
  return formData
}

describe('lookupMedicalRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.10' }))
    mockRedirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`)
    })
  })

  it('redirects to the verification slug for active approved records', async () => {
    mockFindUnique.mockResolvedValue({
      verificationSlug: 'v_testslug',
      status: 'ACTIVE',
      revokedAt: null,
      submission: {
        status: SubmissionStatus.APPROVED,
        refundedAt: null,
      },
    })

    await expect(lookupMedicalRecord({}, buildFormData(' a7b3 c9d2 '))).rejects.toThrow(
      'NEXT_REDIRECT:/verify/v_testslug'
    )

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { medicalRecordNumber: 'A7B3C9D2' },
      })
    )
  })

  it('returns the same generic error for unknown records', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await lookupMedicalRecord({}, buildFormData('NOTREAL0'))

    expect(result.error).toBe(
      'We could not verify this document. Please check the Medical Record # and try again.'
    )
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('returns the same generic error for revoked or non-approved records', async () => {
    mockFindUnique.mockResolvedValue({
      verificationSlug: 'v_revoked',
      status: 'REVOKED',
      revokedAt: new Date(),
      submission: {
        status: SubmissionStatus.APPROVED,
        refundedAt: null,
      },
    })

    await expect(
      lookupMedicalRecord({}, buildFormData('A7B3C9D2'))
    ).resolves.toMatchObject({
      error: 'We could not verify this document. Please check the Medical Record # and try again.',
    })

    mockFindUnique.mockResolvedValue({
      verificationSlug: 'v_pending',
      status: 'ACTIVE',
      revokedAt: null,
      submission: {
        status: SubmissionStatus.PENDING_REVIEW,
        refundedAt: null,
      },
    })

    await expect(
      lookupMedicalRecord({}, buildFormData('A7B3C9D2'))
    ).resolves.toMatchObject({
      error: 'We could not verify this document. Please check the Medical Record # and try again.',
    })

    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('returns the same generic error for refunded records', async () => {
    mockFindUnique.mockResolvedValue({
      verificationSlug: 'v_refunded',
      status: 'ACTIVE',
      revokedAt: null,
      submission: {
        status: SubmissionStatus.APPROVED,
        refundedAt: new Date(),
      },
    })

    await expect(
      lookupMedicalRecord({}, buildFormData('A7B3C9D2'))
    ).resolves.toMatchObject({
      error: 'We could not verify this document. Please check the Medical Record # and try again.',
    })

    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
