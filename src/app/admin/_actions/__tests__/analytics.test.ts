import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFindCustomerSubmissions } = vi.hoisted(() => ({
  mockFindCustomerSubmissions: vi.fn(),
}))

vi.mock('@/db/submissions', () => ({
  findBusinessAnalyticsPage: vi.fn(),
  findFriendsFamilyAnalyticsPage: vi.fn(),
  findFriendsFamilyCustomerSubmissions: mockFindCustomerSubmissions,
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: 'doctor-1', email: 'd@example.com' } }),
    },
  },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

import { getFriendsFamilyCustomerDetail } from '../analytics'

describe('getFriendsFamilyCustomerDetail', () => {
  beforeEach(() => {
    mockFindCustomerSubmissions.mockReset()
    mockFindCustomerSubmissions.mockResolvedValue([])
  })

  it('looks a patient key up by the date of birth it names', async () => {
    await getFriendsFamilyCustomerDetail('patient:jane:doe:2000-02-29')

    expect(mockFindCustomerSubmissions).toHaveBeenCalledWith({
      by: 'patient',
      firstName: 'jane',
      lastName: 'doe',
      dateOfBirth: new Date('2000-02-29T00:00:00.000Z'),
    })
  })

  it('refuses a patient key whose date of birth is not a real day', async () => {
    const result = await getFriendsFamilyCustomerDetail('patient:jane:doe:2023-02-29')

    expect(result).toEqual({ success: false, error: 'Customer not found' })
    expect(mockFindCustomerSubmissions).not.toHaveBeenCalled()
  })
})
