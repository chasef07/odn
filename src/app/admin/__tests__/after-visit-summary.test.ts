import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SubmissionStatus } from '@/db/types'

const {
  mockGetSession,
  mockFindSubmissionById,
  mockFindPriorCharts,
  mockWouldExceedMonthlyLimit,
  mockBuildAfterVisitSummary,
  mockGenerateAfterVisitSummaryPDF,
  mockSendAfterVisitSummaryEmail,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindSubmissionById: vi.fn(),
  mockFindPriorCharts: vi.fn(),
  mockWouldExceedMonthlyLimit: vi.fn(),
  mockBuildAfterVisitSummary: vi.fn(),
  mockGenerateAfterVisitSummaryPDF: vi.fn(),
  mockSendAfterVisitSummaryEmail: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/db/submissions', () => ({
  findSubmissionById: mockFindSubmissionById,
  findPriorCharts: mockFindPriorCharts,
}))
vi.mock('@/lib/monthly-limit', () => ({ wouldExceedMonthlyLimit: mockWouldExceedMonthlyLimit }))
vi.mock('@/lib/after-visit-summary', () => ({ buildAfterVisitSummary: mockBuildAfterVisitSummary }))
vi.mock('@/lib/pdf/generate-pdf', () => ({
  generateAfterVisitSummaryPDF: mockGenerateAfterVisitSummaryPDF,
  generateAfterVisitSummaryFilename: (id: string) => `after-visit-summary-${id}.pdf`,
}))
vi.mock('@/lib/email', () => ({ sendAfterVisitSummaryEmail: mockSendAfterVisitSummaryEmail }))

import { sendAfterVisitSummary } from '@/app/admin/_actions/after-visit-summary'

const chart = {
  id: 'sub_123',
  status: SubmissionStatus.APPROVED,
  patientFirstName: 'Isaiah',
  patientLastName: 'Bandoo',
  patientDateOfBirth: new Date('2000-09-14T00:00:00.000Z'),
  email: 'patient@example.test',
  firstDayOff: new Date('2026-09-29T00:00:00.000Z'),
  lastDayOff: new Date('2026-09-30T00:00:00.000Z'),
  reviewedAt: new Date('2026-09-30T11:50:00.000Z'),
  createdAt: new Date('2026-09-30T10:00:00.000Z'),
}

const history = [{ id: 'sub_prior' }]
const summary = { signer: 'Jason Buchwald, MD FACEP' }
const pdf = Buffer.from('pdf')

describe('sendAfterVisitSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetSession.mockResolvedValue({
      user: { id: 'doctor_123', email: 'doctor@example.test', emailVerified: true },
    })
    mockFindSubmissionById.mockResolvedValue(chart)
    mockFindPriorCharts.mockResolvedValue(history)
    mockWouldExceedMonthlyLimit.mockResolvedValue({
      currentUsage: { totalDays: 6 },
      requestedDays: 2,
      newTotal: 8,
      wouldExceed: true,
    })
    mockBuildAfterVisitSummary.mockReturnValue(summary)
    mockGenerateAfterVisitSummaryPDF.mockResolvedValue(pdf)
    mockSendAfterVisitSummaryEmail.mockResolvedValue({ data: { id: 'email_1' } })
  })

  it('builds the summary from the chart, its history and the 30-day limit, then emails it', async () => {
    await expect(
      sendAfterVisitSummary('sub_123', { freeText: { additionalInformation: 'Saw urgent care' } })
    ).resolves.toEqual({ success: true })

    expect(mockFindPriorCharts).toHaveBeenCalledWith(
      {
        patientFirstName: 'Isaiah',
        patientLastName: 'Bandoo',
        patientDateOfBirth: chart.patientDateOfBirth,
      },
      chart.createdAt
    )
    expect(mockWouldExceedMonthlyLimit).toHaveBeenCalledWith(
      'Isaiah',
      'Bandoo',
      '2000-09-14',
      '2026-09-29',
      '2026-09-30',
      chart.reviewedAt
    )
    expect(mockBuildAfterVisitSummary).toHaveBeenCalledWith({
      submission: chart,
      history,
      rollingLimit: { usedDays: 6, requestedDays: 2, totalDays: 8, exceeded: true },
      physician: { name: 'Jason Buchwald', credentials: 'MD FACEP', npi: '1558307702' },
      freeText: { additionalInformation: 'Saw urgent care' },
    })
    expect(mockGenerateAfterVisitSummaryPDF).toHaveBeenCalledWith(summary)
    expect(mockSendAfterVisitSummaryEmail).toHaveBeenCalledWith({
      patientName: 'Isaiah Bandoo',
      pdfBuffer: pdf,
      pdfFilename: 'after-visit-summary-sub_123.pdf',
    })
  })

  it('refuses a chart that does not exist', async () => {
    mockFindSubmissionById.mockResolvedValue(null)

    await expect(sendAfterVisitSummary('missing', { freeText: {} })).resolves.toEqual({
      success: false,
      error: 'Submission not found',
    })
    expect(mockSendAfterVisitSummaryEmail).not.toHaveBeenCalled()
  })

  it('reports a failure and sends nothing when the summary cannot be built', async () => {
    mockBuildAfterVisitSummary.mockImplementation(() => {
      throw new Error('Only approved or denied charts have an after-visit summary')
    })

    await expect(sendAfterVisitSummary('sub_123', { freeText: {} })).resolves.toEqual({
      success: false,
      error: 'Only approved or denied charts have an after-visit summary',
    })
    expect(mockSendAfterVisitSummaryEmail).not.toHaveBeenCalled()
  })

  it('reports a failed send', async () => {
    mockSendAfterVisitSummaryEmail.mockRejectedValue(new Error('Failed to send AVS email: down'))

    await expect(sendAfterVisitSummary('sub_123', { freeText: {} })).resolves.toEqual({
      success: false,
      error: 'Failed to send AVS email: down',
    })
  })

  it('refuses a caller who is not an admin', async () => {
    mockGetSession.mockResolvedValue(null)

    await expect(sendAfterVisitSummary('sub_123', { freeText: {} })).rejects.toThrow()
    expect(mockFindSubmissionById).not.toHaveBeenCalled()
  })
})
