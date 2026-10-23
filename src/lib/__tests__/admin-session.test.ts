import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession, mockRedirect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

import { adminAction, findAdminSession, requireAdminSession } from '@/lib/admin-session'

function sessionFor(user: { email: string; emailVerified: boolean }) {
  return { user: { id: 'user_1', name: 'Dr Test', ...user }, session: { userId: 'user_1' } }
}

describe('admin session', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockRedirect.mockClear()
  })

  it('lets in a verified email on ADMIN_EMAILS, whatever its case', async () => {
    mockGetSession.mockResolvedValue(
      sessionFor({ email: 'Doctor@Example.TEST', emailVerified: true })
    )

    expect(await findAdminSession(new Headers())).toEqual({
      doctorId: 'user_1',
      email: 'Doctor@Example.TEST',
    })
  })

  it('refuses a signed-in user whose email is not on ADMIN_EMAILS', async () => {
    mockGetSession.mockResolvedValue(
      sessionFor({ email: 'stranger@example.test', emailVerified: true })
    )

    expect(await findAdminSession(new Headers())).toBeNull()
  })

  it('refuses an email on ADMIN_EMAILS that is not verified', async () => {
    mockGetSession.mockResolvedValue(
      sessionFor({ email: 'doctor@example.test', emailVerified: false })
    )

    expect(await findAdminSession(new Headers())).toBeNull()
  })

  it('refuses a request without a session', async () => {
    mockGetSession.mockResolvedValue(null)

    expect(await findAdminSession(new Headers())).toBeNull()
  })

  it('sends a non-allowlisted user from an admin page to the login page', async () => {
    mockGetSession.mockResolvedValue(
      sessionFor({ email: 'stranger@example.test', emailVerified: true })
    )

    await expect(requireAdminSession()).rejects.toThrow('NEXT_REDIRECT /admin/login')
  })

  it('never runs an admin action for a non-allowlisted user', async () => {
    mockGetSession.mockResolvedValue(
      sessionFor({ email: 'stranger@example.test', emailVerified: true })
    )
    const action = vi.fn(async () => 'ran')

    await expect(adminAction(action)()).rejects.toThrow('NEXT_REDIRECT /admin/login')
    expect(action).not.toHaveBeenCalled()
  })

  it('runs an admin action for an allowlisted doctor', async () => {
    mockGetSession.mockResolvedValue(
      sessionFor({ email: 'doctor@example.test', emailVerified: true })
    )
    const action = vi.fn(
      async (admin: { doctorId: string }, id: string) => `${admin.doctorId}:${id}`
    )

    expect(await adminAction(action)('sub_1')).toBe('user_1:sub_1')
  })
})
