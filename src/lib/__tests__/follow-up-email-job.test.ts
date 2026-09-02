import { SubmissionStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFindMany, mockUpdateMany, mockSendFollowUpEmail } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockSendFollowUpEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    submission: {
      findMany: mockFindMany,
      updateMany: mockUpdateMany,
    },
  },
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
    mockFindMany.mockResolvedValue([candidate])
    mockSendFollowUpEmail.mockResolvedValue({ data: { id: 'email_123' }, error: null })
  })

  it('selects only delivered approved notes purchased 5-7 days ago and marks a claimed send', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 })

    const result = await runFollowUpEmailJob(now)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        status: SubmissionStatus.APPROVED,
        approvalEmailSentAt: { not: null },
        followUpEmailSentAt: null,
        createdAt: {
          gte: new Date('2026-08-16T12:00:00.000Z'),
          lte: new Date('2026-08-18T12:00:00.000Z'),
        },
        OR: [
          { followUpEmailClaimedAt: null },
          { followUpEmailClaimedAt: { lte: new Date('2026-08-23T11:30:00.000Z') } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        email: true,
        patientFirstName: true,
        patientLastName: true,
        notePurpose: true,
      },
    })
    expect(mockSendFollowUpEmail).toHaveBeenCalledWith({
      to: 'customer@example.com',
      patientName: 'Alex Doe',
      notePurpose: 'work',
      submissionId: 'sub_123',
    })
    expect(mockUpdateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'sub_123',
        followUpEmailSentAt: null,
        followUpEmailClaimedAt: now,
      },
      data: {
        followUpEmailClaimedAt: null,
        followUpEmailSentAt: now,
      },
    })
    expect(result).toEqual({ eligible: 1, claimed: 1, sent: 1, failed: 0 })
  })

  it('does not send when another invocation wins the claim', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })

    await expect(runFollowUpEmailJob(now)).resolves.toEqual({
      eligible: 1,
      claimed: 0,
      sent: 0,
      failed: 0,
    })
    expect(mockSendFollowUpEmail).not.toHaveBeenCalled()
  })

  it('releases the claim after an explicit provider failure so the next cron can retry', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 })
    mockSendFollowUpEmail.mockRejectedValue(new Error('provider unavailable'))

    await expect(runFollowUpEmailJob(now)).resolves.toEqual({
      eligible: 1,
      claimed: 1,
      sent: 0,
      failed: 1,
    })
    expect(mockUpdateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'sub_123',
        followUpEmailSentAt: null,
        followUpEmailClaimedAt: now,
      },
      data: { followUpEmailClaimedAt: null },
    })
  })
})
