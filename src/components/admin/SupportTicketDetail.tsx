'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, RotateCcw, Search, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  closeSupportTicket,
  markSupportTicketNeedsCsr,
  retrySupportTicketAutomation,
  sendSupportTicketReply,
} from '@/app/admin/support/_actions/ticket-updates'
import { type SupportTicketDetail as SupportTicketDetailType } from '@/db/sms-support'
import {
  supportCategoryLabel,
  supportStatusClass,
  supportStatusLabel,
} from '@/lib/sms-support-types'
import { dateOnlyFromUtcDate, formatInstantET, instantOf } from '@/lib/dates'

export function SupportTicketDetail({ ticket }: { ticket: SupportTicketDetailType }) {
  const router = useRouter()
  const [replyBody, setReplyBody] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sendReply = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await sendSupportTicketReply(ticket.id, replyBody)
      if (result.success) {
        setReplyBody('')
        setMessage('Reply sent.')
        router.refresh()
      } else {
        setMessage(result.error || 'Reply failed.')
      }
    })
  }

  const closeTicket = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await closeSupportTicket(ticket.id)
      setMessage(result.success ? 'Ticket closed.' : result.error || 'Close failed.')
      router.refresh()
    })
  }

  const markNeedsAdmin = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await markSupportTicketNeedsCsr(ticket.id)
      setMessage(
        result.success ? 'Ticket marked for admin review.' : result.error || 'Update failed.'
      )
      router.refresh()
    })
  }

  const retryAutomation = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await retrySupportTicketAutomation(ticket.id)
      setMessage(result.success ? 'Retry ran.' : result.error || 'Retry failed.')
      router.refresh()
    })
  }

  const latestFailedJob = ticket.jobs.find((job) => job.status === 'FAILED')
  const canRetryAutomation =
    !!latestFailedJob && ticket.status === 'NEEDS_CSR' && ticket.automationStatus === 'FAILED'
  const searchPhone = ticket.phoneE164.replace(/^\+1/, '')

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={supportStatusClass(ticket.status)}>
                {supportStatusLabel(ticket.status)}
              </span>
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                {supportCategoryLabel(ticket.category)}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">SMS Support Ticket</h1>
            <p className="mt-1 text-sm break-all text-gray-500">
              {ticket.id} | {ticket.phoneE164}
            </p>
            {ticket.adminSummary && (
              <p className="mt-3 max-w-3xl text-sm break-words text-gray-700">
                {ticket.adminSummary}
              </p>
            )}
            {ticket.failureReason && (
              <div className="mt-3 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{ticket.failureReason}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canRetryAutomation && (
              <Button
                variant="outline"
                onClick={retryAutomation}
                disabled={isPending}
                className="gap-2"
              >
                <RotateCcw data-icon="inline-start" />
                Retry
              </Button>
            )}
            <Button variant="outline" asChild className="gap-2">
              <Link href={`/admin/search?type=phone&q=${encodeURIComponent(searchPhone)}`}>
                <Search data-icon="inline-start" />
                Search All Submissions
              </Link>
            </Button>
            {ticket.status !== 'NEEDS_CSR' && ticket.status !== 'CLOSED' && (
              <Button
                variant="outline"
                onClick={markNeedsAdmin}
                disabled={isPending}
                className="gap-2"
              >
                <AlertTriangle data-icon="inline-start" />
                Needs Admin
              </Button>
            )}
            {ticket.status !== 'CLOSED' && (
              <Button onClick={closeTicket} disabled={isPending} className="gap-2">
                <CheckCircle data-icon="inline-start" />
                Close
              </Button>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
            <div className="mt-4 space-y-3">
              {ticket.messages.length === 0 ? (
                <p className="text-sm text-gray-500">No SMS messages are linked yet.</p>
              ) : (
                ticket.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg border p-3 ${
                      message.direction === 'inbound'
                        ? 'border-gray-200 bg-gray-50'
                        : 'border-blue-100 bg-blue-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                      <span className="font-medium uppercase">{message.direction}</span>
                      <span>
                        {formatInstantET(
                          instantOf(message.receivedAt || message.sentAt || message.createdAt)
                        )}
                      </span>
                    </div>
                    <p className="mt-2 text-sm break-words whitespace-pre-wrap text-gray-800">
                      {message.body}
                    </p>
                    {(message.providerStatus || message.errorMessage) && (
                      <p className="mt-2 text-xs break-words text-gray-500">
                        {message.providerStatus || 'unknown'}
                        {message.errorMessage ? `: ${message.errorMessage}` : ''}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900">Reply By SMS</h2>
            <div className="mt-3 space-y-3">
              <Textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                disabled={isPending || ticket.status === 'CLOSED'}
                rows={4}
                placeholder="Type a concise support reply..."
              />
              <div className="flex justify-end">
                <Button
                  onClick={sendReply}
                  disabled={isPending || ticket.status === 'CLOSED' || !replyBody.trim()}
                  className="gap-2"
                >
                  <Send data-icon="inline-start" />
                  Send Reply
                </Button>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Submission</h2>
            {ticket.submission ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-medium text-gray-900">
                  {ticket.submission.patientFirstName} {ticket.submission.patientLastName}
                </p>
                <p className="break-all text-gray-600">{ticket.submission.email}</p>
                <p className="text-gray-600">
                  DOB: {dateOnlyFromUtcDate(ticket.submission.patientDateOfBirth)}
                </p>
                <p className="text-gray-600">
                  Dates: {dateOnlyFromUtcDate(ticket.submission.firstDayOff)} -{' '}
                  {dateOnlyFromUtcDate(ticket.submission.lastDayOff)}
                </p>
                <p className="text-gray-600">Purpose: {ticket.submission.notePurpose}</p>
                <Link
                  href={`/admin/search/${ticket.submission.id}`}
                  className="inline-flex pt-2 text-sm font-medium text-blue-700 hover:underline"
                >
                  Open submission
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">No submission linked.</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Automation Jobs</h2>
            <div className="mt-3 space-y-3">
              {ticket.jobs.length === 0 ? (
                <p className="text-sm text-gray-500">No jobs queued.</p>
              ) : (
                ticket.jobs.map((job) => (
                  <div key={job.id} className="rounded-md border border-gray-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">
                        {supportStatusLabel(job.status)}
                      </span>
                      <span className="text-xs text-gray-500">Attempts: {job.attempts}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatInstantET(instantOf(job.createdAt))}
                    </p>
                    {job.lastError && (
                      <p className="mt-2 text-xs break-words text-red-700">{job.lastError}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
