import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreate,
  mockFindUnique,
  mockFindMany,
  mockUpdate,
  mockDelete,
  mockDeleteMany,
  mockCount,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockCount: vi.fn(),
}))

vi.mock('../client', () => ({
  default: {
    temporarySubmission: {
      create: mockCreate,
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      update: mockUpdate,
      delete: mockDelete,
      deleteMany: mockDeleteMany,
      count: mockCount,
    },
  },
}))

import {
  attachPaymentIntentToTemporarySubmission,
  countExpiredTemporarySubmissions,
  countTemporarySubmissions,
  createTemporarySubmission,
  deleteExpiredTemporarySubmissions,
  deleteTemporarySubmission,
  findRecentTemporarySubmissions,
  findTemporarySubmissionById,
  findTemporarySubmissionByPaymentIntent,
} from '../temporary-submissions'

const row = {
  id: 'temp_123',
  paymentIntentId: 'pi_123',
  formData: { email: 'john@example.com' },
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  expiresAt: new Date('2026-08-06T00:00:00.000Z'),
}

describe('temporary submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a temporary submission with the pending payment intent, form data, and expiry', async () => {
    mockCreate.mockResolvedValue(row)
    const expiresAt = new Date('2026-08-06T00:00:00.000Z')

    await expect(
      createTemporarySubmission({
        paymentIntentId: 'pending_1',
        formData: { email: 'john@example.com' },
        expiresAt,
      })
    ).resolves.toBe(row)

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        paymentIntentId: 'pending_1',
        formData: { email: 'john@example.com' },
        expiresAt,
      },
    })
  })

  it('finds a temporary submission by payment intent', async () => {
    mockFindUnique.mockResolvedValue(row)

    await expect(findTemporarySubmissionByPaymentIntent('pi_123')).resolves.toBe(row)

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { paymentIntentId: 'pi_123' } })
  })

  it('finds a temporary submission by id', async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(findTemporarySubmissionById('temp_123')).resolves.toBeNull()

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'temp_123' } })
  })

  it('attaches the payment intent id and returns the updated row', async () => {
    mockUpdate.mockResolvedValue(row)

    await expect(attachPaymentIntentToTemporarySubmission('temp_123', 'pi_123')).resolves.toBe(row)

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'temp_123' },
      data: {
        paymentIntentId: 'pi_123',
      },
    })
  })

  it('deletes a temporary submission by id', async () => {
    mockDelete.mockResolvedValue(row)

    await expect(deleteTemporarySubmission('temp_123')).resolves.toBeUndefined()

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'temp_123' } })
  })

  it('deletes temporary submissions that expired before now and reports the count', async () => {
    mockDeleteMany.mockResolvedValue({ count: 3 })
    const now = new Date('2026-08-23T12:00:00.000Z')

    await expect(deleteExpiredTemporarySubmissions(now)).resolves.toEqual({ count: 3 })

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    })
  })

  it('counts every temporary submission', async () => {
    mockCount.mockResolvedValue(7)

    await expect(countTemporarySubmissions()).resolves.toBe(7)

    expect(mockCount).toHaveBeenCalledWith()
  })

  it('counts temporary submissions that expired before now', async () => {
    mockCount.mockResolvedValue(2)
    const now = new Date('2026-08-23T12:00:00.000Z')

    await expect(countExpiredTemporarySubmissions(now)).resolves.toBe(2)

    expect(mockCount).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    })
  })

  it('lists the five newest temporary submissions without form data', async () => {
    mockFindMany.mockResolvedValue([])

    await expect(findRecentTemporarySubmissions()).resolves.toEqual([])

    expect(mockFindMany).toHaveBeenCalledWith({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        paymentIntentId: true,
        createdAt: true,
        expiresAt: true,
      },
    })
  })
})
