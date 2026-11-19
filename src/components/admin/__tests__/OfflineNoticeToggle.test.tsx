import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockTurnOff, mockTurnOn, mockRefresh } = vi.hoisted(() => ({
  mockTurnOff: vi.fn(),
  mockTurnOn: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/app/admin/support/_actions/offline-notice', () => ({
  turnOffOfflineNotice: mockTurnOff,
  turnOnOfflineNotice: mockTurnOn,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { OfflineNoticeToggle } from '../OfflineNoticeToggle'

describe('OfflineNoticeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTurnOff.mockResolvedValue(undefined)
    mockTurnOn.mockResolvedValue(undefined)
  })

  it('shows the auto-reply on and turns it off', async () => {
    render(<OfflineNoticeToggle pausedUntil={null} />)

    const toggle = screen.getByRole('switch', { name: 'Overnight auto-reply' })
    expect(toggle).toBeChecked()
    expect(
      screen.getByText(/^On\. Patients who text between 12:00 AM and 7:00 AM ET/)
    ).toBeVisible()

    await userEvent.click(toggle)

    expect(mockTurnOff).toHaveBeenCalledTimes(1)
    expect(mockTurnOn).not.toHaveBeenCalled()
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('shows when it turns back on by itself and turns it back on now', async () => {
    render(<OfflineNoticeToggle pausedUntil={new Date('2026-11-19T12:00:00Z')} />)

    const toggle = screen.getByRole('switch', { name: 'Overnight auto-reply' })
    expect(toggle).not.toBeChecked()
    expect(
      screen.getByText('Off until Nov 19, 7:00 AM EST. It turns back on by itself.')
    ).toBeVisible()

    await userEvent.click(toggle)

    expect(mockTurnOn).toHaveBeenCalledTimes(1)
    expect(mockTurnOff).not.toHaveBeenCalled()
  })

  it('says so when the change fails', async () => {
    mockTurnOff.mockRejectedValue(new Error('database down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<OfflineNoticeToggle pausedUntil={null} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Overnight auto-reply' }))

    expect(
      await screen.findByText('Could not change the overnight auto-reply. Refresh and try again.')
    ).toBeVisible()
    expect(mockRefresh).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
