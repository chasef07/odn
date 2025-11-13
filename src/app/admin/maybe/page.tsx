/**
 * Maybe Portal Page
 * Shows table of all MAYBE submissions
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { Button } from '@/components/ui/button'
import { getMaybeSubmissions } from '../actions'
import { MaybeActionButtons } from '@/components/admin/MaybeActionButtons'

export default async function MaybePortalPage() {
  // SECURITY: Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  // Fetch all maybe submissions
  const result = await getMaybeSubmissions()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
                Admin Portal
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{session.user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Maybe Submissions</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.success ? `${result.submissions.length} submissions need review` : 'Failed to load submissions'}
              </p>
            </div>
            <Link href="/admin">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>

          {/* Error state */}
          {!result.success && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">{result.error || 'Failed to load maybe submissions'}</p>
            </div>
          )}

          {/* Empty state */}
          {result.success && result.submissions.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <div className="mx-auto max-w-md">
                <div className="text-6xl mb-4">📋</div>
                <h2 className="text-xl font-semibold text-gray-900">No Maybe Submissions</h2>
                <p className="mt-2 text-sm text-gray-600">
                  All submissions marked as "Maybe" will appear here for further review.
                </p>
                <Link href="/admin/review" className="mt-6 inline-block">
                  <Button>Go to Review Queue</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Table view */}
          {result.success && result.submissions.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
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
                      Absence Dates
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      Submission ID
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      Marked as Maybe
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {result.submissions.map((submission) => (
                    <tr
                      key={submission.id}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {submission.patientFirstName} {submission.patientLastName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {submission.firstDayOff === submission.lastDayOff
                          ? new Date(submission.firstDayOff + 'T12:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : `${new Date(submission.firstDayOff + 'T12:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })} - ${new Date(submission.lastDayOff + 'T12:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}`}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 font-mono">
                        {submission.id}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {submission.reviewedAt
                          ? new Date(submission.reviewedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <MaybeActionButtons submissionId={submission.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
