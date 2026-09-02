import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRunFollowUpEmailJob } = vi.hoisted(() => ({
  mockRunFollowUpEmailJob: vi.fn(),
}))

vi.mock('@/lib/follow-up-email-job', () => ({
  runFollowUpEmailJob: mockRunFollowUpEmailJob,
}))

import { GET } from '../route'

describe('GET /api/cron/send-note-follow-ups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  it('rejects requests without the Vercel cron secret', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/send-note-follow-ups'))

    expect(response.status).toBe(401)
    expect(mockRunFollowUpEmailJob).not.toHaveBeenCalled()
  })

  it('runs the single follow-up owner when authorized', async () => {
    mockRunFollowUpEmailJob.mockResolvedValue({ eligible: 2, claimed: 2, sent: 2, failed: 0 })
    const request = new NextRequest('http://localhost/api/cron/send-note-follow-ups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })

    const response = await GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      eligible: 2,
      claimed: 2,
      sent: 2,
      failed: 0,
    })
    expect(mockRunFollowUpEmailJob).toHaveBeenCalledOnce()
  })

  it('surfaces partial delivery failures so cron monitoring can detect and retry them', async () => {
    mockRunFollowUpEmailJob.mockResolvedValue({ eligible: 2, claimed: 2, sent: 1, failed: 1 })
    const request = new NextRequest('http://localhost/api/cron/send-note-follow-ups', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })

    const response = await GET(request)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      eligible: 2,
      claimed: 2,
      sent: 1,
      failed: 1,
    })
  })
})
