import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { popup, social, replace } = vi.hoisted(() => ({
  popup: vi.fn(),
  social: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { popup, social } } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

import { GoogleSignInButton } from '@/components/admin/GoogleSignInButton'

const destinations = { callbackURL: '/admin', errorCallbackURL: '/admin/login' }

async function clickSignIn() {
  render(<GoogleSignInButton />)
  await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
}

describe('Google sign-in button', () => {
  beforeEach(() => {
    popup.mockReset()
    social.mockReset()
    replace.mockReset()
  })

  it('signs in through a Google popup and opens the admin page without a full redirect', async () => {
    popup.mockResolvedValue({ data: { success: true }, error: null })

    await clickSignIn()

    expect(popup).toHaveBeenCalledWith({ provider: 'google', ...destinations })
    expect(replace).toHaveBeenCalledWith('/admin')
    expect(social).not.toHaveBeenCalled()
  })

  it('falls back to the full-page Google redirect when the browser blocks the popup', async () => {
    popup.mockResolvedValue({ data: null, error: { code: 'POPUP_BLOCKED' } })
    social.mockResolvedValue({ data: { url: 'https://accounts.google.com' }, error: null })

    await clickSignIn()

    expect(social).toHaveBeenCalledWith({ provider: 'google', ...destinations })
    expect(replace).not.toHaveBeenCalled()
  })

  it('shows why a Google account off the admin list was refused', async () => {
    popup.mockResolvedValue({
      data: null,
      error: { code: 'not_an_admin', message: 'This Google account is not allowed' },
    })

    await clickSignIn()

    expect(
      screen.getByText(/This Google account is not allowed to use the admin portal/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('lets the admin try again after closing the popup', async () => {
    popup.mockResolvedValue({ data: null, error: { code: 'POPUP_CLOSED' } })

    await clickSignIn()

    expect(screen.getByText('Google sign-in was closed. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  })

  it('says so when the redirect fallback cannot start', async () => {
    popup.mockResolvedValue({ data: null, error: { code: 'POPUP_BLOCKED' } })
    social.mockResolvedValue({ data: null, error: { code: 'INTERNAL', message: 'down' } })

    await clickSignIn()

    expect(screen.getByText('Google sign-in did not finish. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  })

  it('lets the admin try again when sign-in throws', async () => {
    popup.mockRejectedValue(new Error('network down'))

    await clickSignIn()

    expect(screen.getByText('Google sign-in did not finish. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  })
})
