import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFindDueFollowUpEmails,
  mockClaimDueFollowUpEmail,
  mockReleaseFollowUpEmailClaimAt,
  mockAcknowledgeFollowUpEmailSent,
  mockSendFollowUpEmail,
} = vi.hoisted(() => ({
  mockFindDueFollowUpEmails: vi.fn(),
  mockClaimDueFollowUpEmail: vi.fn(),
  mockReleaseFollowUpEmailClaimAt: vi.fn(),
  mockAcknowledgeFollowUpEmailSent: vi.fn(),
  mockSendFollowUpEmail: vi.fn(),
}))

vi.mock('@/db/submissions', () => ({
  findDueFollowUpEmails: mockFindDueFollowUpEmails,
  claimDueFollowUpEmail: mockClaimDueFollowUpEmail,
  releaseFollowUpEmailClaimAt: mockReleaseFollowUpEmailClaimAt,
  acknowledgeFollowUpEmailSent: mockAcknowledgeFollowUpEmailSent,
}))

vi.mock('@/lib/email', () => ({ sendFollowUpEmail: mockSendFollowUpEmail }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { runFollowUpEmailJob } from '../follow-up-email-job'

const now = new Date('2026-08-23T12:00:00.000Z')
const candidate = {
  id: 'sub_123',
  email: 'customer@example.com',
  patientFirstName: 'Alex',
  patientLastName: 'Doe',
  notePurpose: 'work',
}

describe('runFollowUpEmailJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindDueFollowUpEmails.mockResolvedValue([candidate])
    mockSendFollowUpEmail.mockResolvedValue({ data: { id: 'email_123' }, error: null })
  })

  it('selects only delivered approved notes purchased 5-7 days ago and marks a claimed send', async () => {
    mockClaimDueFollowUpEmail.mockResolvedValueOnce(1)
    mockAcknowledgeFollowUpEmailSent.mockResolvedValueOnce(1)

    const result = await runFollowUpEmailJob(now)

    expect(mockFindDueFollowUpEmails).toHaveBeenCalledWith(now)
    expect(mockClaimDueFollowUpEmail).toHaveBeenCalledWith('sub_123', now)
    expect(mockSendFollowUpEmail).toHaveBeenCalledWith({
      to: 'customer@example.com',
      patientName: 'Alex Doe',
      notePurpose: 'work',
      submissionId: 'sub_123',
    })
    expect(mockAcknowledgeFollowUpEmailSent).toHaveBeenCalledWith('sub_123', now)
    expect(mockReleaseFollowUpEmailClaimAt).not.toHaveBeenCalled()
    expect(result).toEqual({ eligible: 1, claimed: 1, sent: 1, failed: 0 })
  })

  it('does not send when another invocation wins the claim', async () => {
    mockClaimDueFollowUpEmail.mockResolvedValueOnce(0)

    await expect(runFollowUpEmailJob(now)).resolves.toEqual({
      eligible: 1,
      claimed: 0,
      sent: 0,
      failed: 0,
    })
    expect(mockSendFollowUpEmail).not.toHaveBeenCalled()
  })

  it('releases the claim after an explicit provider failure so the next cron can retry', async () => {
    mockClaimDueFollowUpEmail.mockResolvedValueOnce(1)
    mockReleaseFollowUpEmailClaimAt.mockResolvedValueOnce(undefined)
    mockSendFollowUpEmail.mockRejectedValue(new Error('provider unavailable'))

    await expect(runFollowUpEmailJob(now)).resolves.toEqual({
      eligible: 1,
      claimed: 1,
      sent: 0,
      failed: 1,
    })
    expect(mockReleaseFollowUpEmailClaimAt).toHaveBeenCalledWith('sub_123', now)
    expect(mockAcknowledgeFollowUpEmailSent).not.toHaveBeenCalled()
  })
})
