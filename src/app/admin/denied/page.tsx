/**
 * Denied Submissions Page
 * Shows all submissions denied today with visual confirmation
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { getDeniedSubmissionsForToday } from '../actions'
import { formatDateWithTime } from '@/lib/admin-utils'

export default async function DeniedSubmissionsPage() {
  // SECURITY: Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  // Fetch denied submissions for today
  const result = await getDeniedSubmissionsForToday()

  if (!result.success || !result.data) {
    return (
      <div>
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
            <div>
              <h1 className="text-3xl font-bold text-foreground">Denied Submissions</h1>
              <p className="text-red-600 mt-1">Failed to load denied submissions. Please try again.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const submissions = result.data

  return (
    <div>
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
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-red-600">Denied Submissions</h1>
              <p className="text-muted-foreground mt-1">
                {submissions.length} {submissions.length === 1 ? 'denial' : 'denials'} today
              </p>
            </div>
            <Link href="/admin">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>

          {/* Table or Empty State */}
          {submissions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-2xl font-bold mb-2">No denials today</h2>
              <p className="text-muted-foreground mb-6">All denied submissions will appear here</p>
              <Link href="/admin">
                <Button>Back to Dashboard</Button>
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden border border-red-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Denied At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-red-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {submission.patientFirstName} {submission.patientLastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {submission.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {submission.denialEmailSentAt
                          ? formatDateWithTime(submission.denialEmailSentAt)
                          : 'N/A'}
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
