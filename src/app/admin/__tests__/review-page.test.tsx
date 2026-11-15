import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pendingSubmission } from './pending-fixtures'

let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams,
}))

vi.mock('@/app/admin/_actions/queues', () => ({
  getSubmissionsForReview: vi.fn(async () => ({
    success: true,
    data: [
      pendingSubmission({ id: 'first', patientFirstName: 'Ann', patientLastName: 'First' }),
      pendingSubmission({ id: 'second', patientFirstName: 'Bo', patientLastName: 'Second' }),
      pendingSubmission({ id: 'third', patientFirstName: 'Cy', patientLastName: 'Third' }),
    ],
  })),
  getMonthlyLimitData: vi.fn(async () => ({ success: false })),
}))

vi.mock('@/app/admin/_actions/search', () => ({
  getPatientHistory: vi.fn(async () => ({ success: true, data: [] })),
}))

vi.mock('@/app/admin/_actions/approve', () => ({ approveSubmission: vi.fn() }))
vi.mock('@/app/admin/_actions/deny', () => ({ denySubmission: vi.fn() }))
vi.mock('@/app/admin/_actions/maybe', () => ({ maybeSubmission: vi.fn() }))
vi.mock('@/app/admin/_actions/edits', () => ({
  updateReviewClassification: vi.fn(),
  removeGuardianFromAdultSubmission: vi.fn(),
}))

const { default: AdminReviewPage } = await import('@/app/admin/review/page')

describe('review page', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams()
  })

  it('starts with the oldest pending submission', async () => {
    render(<AdminReviewPage />)

    expect(await screen.findByText('1 of 3')).toBeInTheDocument()
    expect(screen.getByText('Ann First')).toBeInTheDocument()
  })

  it('opens on the submission named by id, then keeps the rest of the queue', async () => {
    searchParams = new URLSearchParams('id=third')

    render(<AdminReviewPage />)

    expect(await screen.findByText('1 of 3')).toBeInTheDocument()
    expect(screen.getByText('Cy Third')).toBeInTheDocument()
    expect(screen.queryByText('Ann First')).toBeNull()
    expect(screen.queryByText(/no longer pending/)).toBeNull()
  })

  it('says so when the named submission is no longer pending, then starts with the oldest', async () => {
    searchParams = new URLSearchParams('id=already-reviewed')

    render(<AdminReviewPage />)

    expect(await screen.findByText(/That submission is no longer pending/)).toBeInTheDocument()
    expect(screen.getByText('Ann First')).toBeInTheDocument()
  })

  it('shows no notice when no submission is named', async () => {
    render(<AdminReviewPage />)

    expect(await screen.findByText('Ann First')).toBeInTheDocument()
    expect(screen.queryByText(/no longer pending/)).toBeNull()
  })
})
