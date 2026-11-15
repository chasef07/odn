import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findAdminSession, redirect } = vi.hoisted(() => ({
  findAdminSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
}))

vi.mock('@/lib/admin-session', () => ({ findAdminSession }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/components/admin/GoogleSignInButton', () => ({ GoogleSignInButton: () => null }))

const { default: AdminLoginPage } = await import('@/app/admin/login/page')

function page(error?: string) {
  return AdminLoginPage({ searchParams: Promise.resolve({ error }) })
}

describe('admin login page', () => {
  beforeEach(() => {
    findAdminSession.mockReset()
  })

  it('sends an admin who is already signed in straight to the dashboard', async () => {
    findAdminSession.mockResolvedValue({ doctorId: 'user_1', email: 'doctor@example.test' })

    await expect(page()).rejects.toThrow('NEXT_REDIRECT /admin')
  })

  it('asks a signed-out visitor to sign in', async () => {
    findAdminSession.mockResolvedValue(null)

    expect(renderToString(await page())).toContain('Sign in with Google')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('shows the admin-list refusal from a redirect sign-in', async () => {
    findAdminSession.mockResolvedValue(null)

    expect(renderToString(await page('not_an_admin'))).toContain(
      'This Google account is not allowed to use the admin portal'
    )
  })
})
