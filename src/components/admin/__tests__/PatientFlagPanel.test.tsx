import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetPatientFlag, mockSetPatientFlag, mockClearPatientFlag } = vi.hoisted(() => ({
  mockGetPatientFlag: vi.fn(),
  mockSetPatientFlag: vi.fn(),
  mockClearPatientFlag: vi.fn(),
}))

vi.mock('@/app/admin/_actions/patient-flags', () => ({
  getPatientFlag: mockGetPatientFlag,
  setPatientFlag: mockSetPatientFlag,
  clearPatientFlag: mockClearPatientFlag,
}))

import { PatientFlagPanel } from '../PatientFlagPanel'

const flag = {
  reason: 'Asked for back-dated notes twice',
  flaggedBy: 'doc@example.com',
  flaggedAt: new Date('2026-11-14T15:30:00.000Z'),
}

describe('PatientFlagPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows FLAGGED with the reason, who flagged the patient and when', async () => {
    mockGetPatientFlag.mockResolvedValue({ success: true, flag })

    render(<PatientFlagPanel submissionId="sub_later" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('FLAGGED')
    expect(alert).toHaveTextContent('Asked for back-dated notes twice')
    expect(alert).toHaveTextContent('Flagged by doc@example.com on Nov 14, 2026, 10:30 AM EST')
    expect(mockGetPatientFlag).toHaveBeenCalledWith('sub_later')
  })

  it('says it is checking the flag until it has loaded', async () => {
    mockGetPatientFlag.mockResolvedValue({ success: true, flag })

    render(<PatientFlagPanel submissionId="sub_later" />)

    expect(screen.getByText('Checking patient flag...')).toBeVisible()
    await screen.findByRole('alert')
    expect(screen.queryByText('Checking patient flag...')).not.toBeInTheDocument()
  })

  it('shows only a Flag patient button when the patient is not flagged', async () => {
    mockGetPatientFlag.mockResolvedValue({ success: true, flag: null })

    render(<PatientFlagPanel submissionId="sub_other" />)

    expect(await screen.findByRole('button', { name: 'Flag patient' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('FLAGGED')).not.toBeInTheDocument()
  })

  it('flags the patient with the typed reason and then shows FLAGGED', async () => {
    mockGetPatientFlag.mockResolvedValue({ success: true, flag: null })
    mockSetPatientFlag.mockResolvedValue({ success: true, flag })
    const user = userEvent.setup()
    render(<PatientFlagPanel submissionId="sub_first" />)

    await user.click(await screen.findByRole('button', { name: 'Flag patient' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Reason (optional)' }),
      'Asked for back-dated notes twice'
    )
    await user.click(screen.getByRole('button', { name: 'Save flag' }))

    expect(mockSetPatientFlag).toHaveBeenCalledWith('sub_first', 'Asked for back-dated notes twice')
    expect(await screen.findByRole('alert')).toHaveTextContent('FLAGGED')
  })

  it('unflags the patient', async () => {
    mockGetPatientFlag.mockResolvedValue({ success: true, flag })
    mockClearPatientFlag.mockResolvedValue({ success: true, flag: null })
    const user = userEvent.setup()
    render(<PatientFlagPanel submissionId="sub_later" />)

    await user.click(await screen.findByRole('button', { name: 'Unflag' }))

    expect(mockClearPatientFlag).toHaveBeenCalledWith('sub_later')
    expect(await screen.findByRole('button', { name: 'Flag patient' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error when the flag cannot be saved', async () => {
    mockGetPatientFlag.mockResolvedValue({ success: true, flag: null })
    mockSetPatientFlag.mockResolvedValue({ success: false, error: 'Failed to flag patient' })
    const user = userEvent.setup()
    render(<PatientFlagPanel submissionId="sub_first" />)

    await user.click(await screen.findByRole('button', { name: 'Flag patient' }))
    await user.click(screen.getByRole('button', { name: 'Save flag' }))

    expect(await screen.findByText('Failed to flag patient')).toBeVisible()
  })

  it('shows the error when the flag cannot be loaded', async () => {
    mockGetPatientFlag.mockResolvedValue({ success: false, error: 'Failed to load patient flag' })

    render(<PatientFlagPanel submissionId="sub_first" />)

    expect(await screen.findByText('Failed to load patient flag')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Flag patient' })).not.toBeInTheDocument()
  })
})
