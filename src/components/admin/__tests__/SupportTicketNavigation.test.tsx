import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SupportTicketDetail as SupportTicketDetailType } from '@/app/admin/support/actions'
import { SupportTicketDetail } from '../SupportTicketDetail'
import { SupportTicketQueue } from '../SupportTicketQueue'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/admin/support/actions', () => ({
  closeSupportTicket: vi.fn(),
  markSupportTicketNeedsCsr: vi.fn(),
  retrySupportTicketAutomation: vi.fn(),
  sendSupportTicketReply: vi.fn(),
}))

describe('SMS support navigation', () => {
  it('links the queue to submission search without a manual job runner', () => {
    render(<SupportTicketQueue tickets={[]} />)

    expect(screen.getByRole('link', { name: 'Search All Submissions' })).toHaveAttribute(
      'href',
      '/admin/search'
    )
    expect(screen.queryByRole('button', { name: 'Run Jobs' })).not.toBeInTheDocument()
  })

  it('links a ticket to phone-prefilled submission search beside Needs Admin', () => {
    render(<SupportTicketDetail ticket={supportTicket} />)

    const searchLink = screen.getByRole('link', { name: 'Search All Submissions' })
    const needsAdminButton = screen.getByRole('button', { name: 'Needs Admin' })

    expect(searchLink).toHaveAttribute('href', '/admin/search?type=phone&q=%2B15551234567')
    expect(searchLink.parentElement).toContainElement(needsAdminButton)
  })
})

const supportTicket: SupportTicketDetailType = {
  id: 'ticket_123',
  phoneE164: '+15551234567',
  submissionId: null,
  status: 'OPEN',
  category: null,
  state: 'CSR_REVIEW',
  source: 'INBOUND_SMS',
  automationKind: null,
  automationStatus: null,
  collectedData: null,
  adminSummary: null,
  failureReason: null,
  retryCount: 0,
  csrAlertedAt: null,
  lastInboundAt: null,
  lastOutboundAt: null,
  closedAt: null,
  createdAt: new Date('2026-08-12T12:00:00Z'),
  updatedAt: new Date('2026-08-12T12:00:00Z'),
  submission: null,
  messages: [],
  jobs: [],
}
