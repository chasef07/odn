import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth-client', () => ({ authClient: { getSession } }))

import { AdminSessionRefresh } from '@/components/admin/AdminSessionRefresh'

describe('admin session refresh', () => {
  it('asks the auth route for the session once per page load, so the cookie is renewed', () => {
    getSession.mockResolvedValue({ data: null, error: null })

    const { rerender } = render(<AdminSessionRefresh />)
    rerender(<AdminSessionRefresh />)

    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('logs a refresh the auth route refused, so a broken renewal is visible', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    getSession.mockResolvedValue({ data: null, error: { status: 500, message: 'down' } })

    render(<AdminSessionRefresh />)

    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Admin session refresh failed:', {
        status: 500,
        message: 'down',
      })
    )
    consoleError.mockRestore()
  })
})
