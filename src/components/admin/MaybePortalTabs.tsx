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
  const emptyMessage = activeTab === 'maybe'
    ? 'All submissions marked as "Maybe" will appear here for further review.'
    : 'Submissions marked for manual handling will appear here. You can approve or deny them without automated emails or refunds.'

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('maybe')}
            className={`
              whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
              ${
                activeTab === 'maybe'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }
            `}
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
            className={`
              whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
              ${
                activeTab === 'manual'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }
            `}
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
        <h2 className="text-2xl font-bold text-foreground">{tabTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}
        </p>
      </div>

      {/* Empty State */}
      {submissions.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="text-6xl mb-4">{activeTab === 'maybe' ? '📋' : '📝'}</div>
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
          <div className="overflow-x-auto rounded-none sm:rounded-lg border-y sm:border border-gray-200 bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Patient Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Absence Dates
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {activeTab === 'maybe' ? 'Marked as Maybe' : 'Marked as Manual'}
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {submissions.map((submission) => (
                <tr
                  key={submission.id}
                  className="transition-colors hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {submission.patientFirstName} {submission.patientLastName}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <a href={`mailto:${submission.email}`} className="text-blue-600 hover:underline">{submission.email}</a>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {formatDateRange(submission.firstDayOff, submission.lastDayOff)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {submission.reviewedAt
                      ? formatDateWithTime(submission.reviewedAt)
                      : 'N/A'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    {activeTab === 'maybe' ? (
                      <MaybeActionButtons submissionId={submission.id} />
                    ) : (
                      <ManualActionButtons submissionId={submission.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
