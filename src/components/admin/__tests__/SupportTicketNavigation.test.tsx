import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SupportTicketDetail as SupportTicketDetailType } from '@/db/sms-support'
import { SupportTicketDetail } from '../SupportTicketDetail'
import { SupportTicketQueue } from '../SupportTicketQueue'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/admin/support/_actions/ticket-updates', () => ({
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
    render(<SupportTicketDetail ticket={supportTicket} history={[]} />)

    const searchLink = screen.getByRole('link', { name: 'Search All Submissions' })
    const needsAdminButton = screen.getByRole('button', { name: 'Needs Admin' })

    expect(searchLink).toHaveAttribute('href', '/admin/search?type=phone&q=5551234567')
    expect(searchLink.parentElement).toContainElement(needsAdminButton)
  })

  it('names an unlinked ticket from the submission that shares its phone', () => {
    const phonePatient = { patientFirstName: 'Ada', patientLastName: 'Lovelace' }
    const { unmount } = render(
      <SupportTicketQueue tickets={[{ ...supportTicket, phonePatient }]} />
    )

    expect(screen.getAllByText('Ada Lovelace (matched by phone)')).not.toHaveLength(0)
    unmount()

    render(<SupportTicketDetail ticket={{ ...supportTicket, phonePatient }} history={[]} />)
    expect(screen.getByText('Ada Lovelace (matched by phone)')).toBeInTheDocument()
  })

  it('shows one queue row per phone, linking to its first ticket', () => {
    render(
      <SupportTicketQueue
        tickets={[
          { ...supportTicket, id: 'ticket_new', adminSummary: 'newest' },
          { ...supportTicket, id: 'ticket_old', adminSummary: 'older' },
          {
            ...supportTicket,
            id: 'ticket_other',
            phoneE164: '+15550000000',
            adminSummary: 'other',
          },
        ]}
      />
    )

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.startsWith('/admin/support/'))
    expect(new Set(hrefs)).toEqual(
      new Set(['/admin/support/ticket_new', '/admin/support/ticket_other'])
    )
    expect(screen.queryByText('older')).not.toBeInTheDocument()
  })

  it('shows the other conversations from the same phone with links to them', () => {
    render(
      <SupportTicketDetail
        ticket={supportTicket}
        history={[
          {
            id: 'ticket_old',
            status: 'CLOSED',
            category: 'NOTE_NOT_RECEIVED',
            adminSummary: null,
            createdAt: new Date('2026-08-10T12:00:00Z'),
            closedAt: new Date('2026-08-10T13:00:00Z'),
            messages: [
              {
                id: 'm1',
                direction: 'inbound',
                body: 'I never got my note',
                createdAt: new Date('2026-08-10T12:00:00Z'),
                receivedAt: null,
                sentAt: null,
              },
            ],
          },
        ]}
      />
    )

    expect(screen.getByRole('heading', { name: 'Other Conversations' })).toBeInTheDocument()
    expect(screen.getByText('I never got my note')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Note Not Received/ })).toHaveAttribute(
      'href',
      '/admin/support/ticket_old'
    )
  })

  it('shows the text the patient wrote for an Other purpose on the linked submission', () => {
    const submission = {
      id: 'sub-1',
      patientFirstName: 'Ada',
      patientLastName: 'Lovelace',
      patientDateOfBirth: new Date('1990-11-01T00:00:00Z'),
      email: 'ada@example.com',
      phone: '(555) 123-4567',
      status: 'APPROVED',
      notePurpose: 'other',
      otherNotePurpose: 'Volunteering',
      firstDayOff: new Date('2026-08-10T00:00:00Z'),
      lastDayOff: new Date('2026-08-11T00:00:00Z'),
      approvalEmailSentAt: null,
      updatedAt: new Date('2026-08-12T12:00:00Z'),
    } satisfies SupportTicketDetailType['submission']

    render(
      <SupportTicketDetail
        ticket={{ ...supportTicket, submissionId: 'sub-1', submission }}
        history={[]}
      />
    )

    expect(screen.getByText('Purpose: Other: Volunteering')).toBeInTheDocument()
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
  phonePatient: null,
  messages: [],
  jobs: [],
}
