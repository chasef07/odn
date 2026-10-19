import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SubmissionStatus } from '@/db/types'
import { buildFriendsFamilyAnalytics } from '@/lib/friends-family-analytics'
import { FriendsFamilyAnalyticsDashboard } from '../FriendsFamilyAnalyticsDashboard'

const { mockExport } = vi.hoisted(() => ({ mockExport: vi.fn() }))

vi.mock('@/app/admin/_actions/analytics', () => ({
  exportFriendsFamilyCustomers: mockExport,
  getFriendsFamilyAnalytics: vi.fn(),
}))

const createdAt = new Date('2026-10-01T15:00:00.000Z')

const analytics = buildFriendsFamilyAnalytics(
  [
    {
      id: 'sub-1',
      status: SubmissionStatus.APPROVED,
      patientFirstName: 'Jane',
      patientLastName: 'Smith',
      patientDateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      guardianFirstName: null,
      guardianLastName: null,
      recipient: 'myself',
      email: 'jane@example.com',
      phone: '(555) 111-2222',
      maybeReason: null,
      stripeRefundId: null,
      refundedAt: null,
      offerCode: null,
      paymentAmount: 2495,
      createdAt,
      reviewedAt: createdAt,
      approvalEmailSentAt: createdAt,
    },
  ],
  new Date('2026-10-16T12:00:00.000Z'),
  { segment: 'all_customers' }
)

describe('friends and family CSV export', () => {
  let downloads: string[]

  beforeEach(() => {
    downloads = []
    mockExport.mockResolvedValue({ success: true, data: [] })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download)
    })
    URL.createObjectURL = vi.fn(() => 'blob:export')
    URL.revokeObjectURL = vi.fn()
    vi.useFakeTimers({ toFake: ['Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('names the file with the ET business day on a late Eastern evening', async () => {
    vi.setSystemTime(new Date('2026-10-17T01:30:00.000Z'))
    render(<FriendsFamilyAnalyticsDashboard analytics={analytics} />)

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    await waitFor(() =>
      expect(downloads).toEqual(['customer-segment-all_customers-2026-10-16.csv'])
    )
  })
})
