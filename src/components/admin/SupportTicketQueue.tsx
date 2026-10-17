import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatDateTimeET } from '@/lib/admin-utils'
import type { SupportTicketListItem } from '@/db/sms-support'
import {
  supportCategoryLabel,
  supportStatusClass,
  supportStatusLabel,
} from '@/lib/sms-support-types'

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Needs Admin', value: 'NEEDS_CSR' },
  { label: 'Running', value: 'RUNNING_AUTOMATION' },
  { label: 'Waiting', value: 'WAITING_CUSTOMER' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Closed', value: 'CLOSED' },
]

export function SupportTicketQueue({
  tickets,
  activeStatus,
}: {
  tickets: SupportTicketListItem[]
  activeStatus?: string
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">SMS Support</h1>
          <p className="mt-1 text-sm text-gray-500">
            Customer-service texts, automation jobs, and admin handoff queue.
          </p>
        </div>
        <Button asChild className="sm:w-auto">
          <Link href="/admin/search">Search All Submissions</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const isActive = (activeStatus || '') === filter.value
          const href = filter.value ? `/admin/support?status=${filter.value}` : '/admin/support'
          return (
            <Link
              key={filter.value || 'all'}
              href={href}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                isActive
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {filter.label}
            </Link>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {tickets.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No support tickets found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Ticket
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Last Message
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {tickets.map((ticket) => {
                  const latestMessage = ticket.messages[0]
                  const patientName = ticket.submission
                    ? `${ticket.submission.patientFirstName} ${ticket.submission.patientLastName}`
                    : ticket.phoneE164

                  return (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 align-top">
                        <Link
                          href={`/admin/support/${ticket.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {supportCategoryLabel(ticket.category)}
                        </Link>
                        <p className="mt-1 text-xs text-gray-500">{ticket.id.slice(0, 12)}...</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-gray-900">{patientName}</p>
                        <p className="text-xs text-gray-500">{ticket.phoneE164}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={supportStatusClass(ticket.status)}>
                          {supportStatusLabel(ticket.status)}
                        </span>
                        {ticket.jobs[0] && (
                          <p className="mt-2 text-xs text-gray-500">
                            Job: {supportStatusLabel(ticket.jobs[0].status)}
                          </p>
                        )}
                      </td>
                      <td className="max-w-md px-4 py-4 align-top">
                        <p className="line-clamp-2 text-sm text-gray-700">
                          {latestMessage?.body || ticket.adminSummary || 'No messages yet'}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right align-top text-sm text-gray-500">
                        {formatDateTimeET(ticket.updatedAt, { includeYear: false })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
