import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession, mockPauseOfflineNotice, mockResumeOfflineNotice, mockRevalidatePath } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockPauseOfflineNotice: vi.fn(),
    mockResumeOfflineNotice: vi.fn(),
    mockRevalidatePath: vi.fn(),
  }))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('@/db/sms-offline-notice', () => ({
  pauseOfflineNotice: mockPauseOfflineNotice,
  resumeOfflineNotice: mockResumeOfflineNotice,
}))

import {
  turnOffOfflineNotice,
  turnOnOfflineNotice,
} from '@/app/admin/support/_actions/offline-notice'

describe('offline notice admin actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: { id: 'admin_123', email: 'doctor@example.test', emailVerified: true },
    })
    mockPauseOfflineNotice.mockResolvedValue(undefined)
    mockResumeOfflineNotice.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('turns the notice off until 7:00 AM ET that morning when used overnight', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-19T10:15:00Z'), toFake: ['Date'] })

    await turnOffOfflineNotice()

    expect(mockPauseOfflineNotice).toHaveBeenCalledWith(new Date('2026-11-19T12:00:00.000Z'))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/support')
  })

  it('turns the notice off for the coming night when used during the day', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-19T22:00:00Z'), toFake: ['Date'] })

    await turnOffOfflineNotice()

    expect(mockPauseOfflineNotice).toHaveBeenCalledWith(new Date('2026-11-20T12:00:00.000Z'))
  })

  it('turns the notice back on', async () => {
    await turnOnOfflineNotice()

    expect(mockResumeOfflineNotice).toHaveBeenCalledTimes(1)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/support')
  })

  it('refuses a caller who is not an admin', async () => {
    mockGetSession.mockResolvedValue(null)

    await expect(turnOffOfflineNotice()).rejects.toThrow()
    await expect(turnOnOfflineNotice()).rejects.toThrow()
    expect(mockPauseOfflineNotice).not.toHaveBeenCalled()
    expect(mockResumeOfflineNotice).not.toHaveBeenCalled()
  })
})
