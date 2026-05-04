'use client'

/**
 * Maybe Portal Tabs Component
 * Displays Maybe Queue and Manual Notes tabs
 */

import { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { MaybeActionButtons } from './MaybeActionButtons'
import { ManualActionButtons } from './ManualActionButtons'
import { formatDateWithTime } from '@/lib/admin-utils'
import { getMaybeReasonLabel } from '@/lib/maybe-reasons'
import type { MaybeSubmission, ManualSubmission } from '@/app/admin/actions'

// Helper to format calendar dates consistently in UTC
function formatCalendarDate(dateString: string): string {
  // Parse YYYY-MM-DD as UTC midnight to avoid timezone shifts
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return formatInTimeZone(date, 'UTC', 'MMM d, yyyy')
}

// Helper to format calendar date range
function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return formatCalendarDate(start)
  }
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay))
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay))

  const startFormatted = formatInTimeZone(startDate, 'UTC', 'MMM d')
  const endFormatted = formatInTimeZone(endDate, 'UTC', 'MMM d, yyyy')
  return `${startFormatted} - ${endFormatted}`
}

interface MaybePortalTabsProps {
  maybeSubmissions: MaybeSubmission[]
  manualSubmissions: ManualSubmission[]
}

export function MaybePortalTabs({ maybeSubmissions, manualSubmissions }: MaybePortalTabsProps) {
  const [activeTab, setActiveTab] = useState<'maybe' | 'manual'>('maybe')

  const submissions = activeTab === 'maybe' ? maybeSubmissions : manualSubmissions
  const tabTitle = activeTab === 'maybe' ? 'Maybe Queue' : 'Manual Notes'
  const emptyMessage =
    activeTab === 'maybe'
      ? 'All submissions marked as "Maybe" will appear here for further review.'
      : 'Submissions marked for manual handling will appear here. You can approve or deny them without automated emails or refunds.'

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('maybe')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
              activeTab === 'maybe'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } `}
          >
            Maybe Queue
            {maybeSubmissions.length > 0 && (
              <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">
                {maybeSubmissions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
              activeTab === 'manual'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } `}
          >
            Manual Notes
            {manualSubmissions.length > 0 && (
              <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">
                {manualSubmissions.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content Header */}
      <div>
        <h2 className="text-foreground text-2xl font-bold">{tabTitle}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}
        </p>
      </div>

      {/* Empty State */}
      {submissions.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-6xl">{activeTab === 'maybe' ? '📋' : '📝'}</div>
            <h3 className="text-xl font-semibold text-gray-900">
              No {activeTab === 'maybe' ? 'Maybe' : 'Manual'} Submissions
            </h3>
            <p className="mt-2 text-sm text-gray-600">{emptyMessage}</p>
          </div>
        </div>
      )}

      {/* Table View */}
      {submissions.length > 0 && (
        <div className="-mx-4 sm:mx-0">
          <div className="overflow-x-auto rounded-none border-y border-gray-200 bg-white shadow sm:rounded-lg sm:border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    Patient Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    Absence Dates
                  </th>
                  {activeTab === 'maybe' && (
                    <>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Reason
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        Email
                      </th>
                    </>
                  )}
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    {activeTab === 'maybe' ? 'Marked as Maybe' : 'Marked as Manual'}
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {submissions.map((submission) => {
                  const maybeSubmission =
                    activeTab === 'maybe' ? (submission as MaybeSubmission) : null
                  const maybeEmailSentAt = maybeSubmission?.maybeEmailSentAt ?? null

                  return (
                    <tr key={submission.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                        {submission.patientFirstName} {submission.patientLastName}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        <a
                          href={`mailto:${submission.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {submission.email}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">
                        {formatDateRange(submission.firstDayOff, submission.lastDayOff)}
                      </td>
                      {maybeSubmission && (
                        <>
                          <td className="max-w-[220px] px-6 py-4 text-sm text-gray-600">
                            {getMaybeReasonLabel(maybeSubmission.maybeReason)}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                            {maybeEmailSentAt ? formatDateWithTime(maybeEmailSentAt) : 'Not sent'}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                        {submission.reviewedAt ? formatDateWithTime(submission.reviewedAt) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                        {activeTab === 'maybe' ? (
                          <MaybeActionButtons submissionId={submission.id} />
                        ) : (
                          <ManualActionButtons submissionId={submission.id} />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
