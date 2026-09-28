import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Search } from 'lucide-react'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { getDeniedSubmissionsForToday } from '../actions'
import { formatDateWithTime } from '@/lib/admin-utils'

export default async function DeniedSubmissionsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  const result = await getDeniedSubmissionsForToday()

  if (!result.success || !result.data) {
    return (
      <div>
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground truncate text-sm">{session.user.email}</span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div>
              <h1 className="text-foreground text-3xl font-bold">Denied Submissions</h1>
              <p className="mt-1 text-red-600">
                Failed to load denied submissions. Please try again.
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const submissions = result.data

  return (
    <div>
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground truncate text-sm">{session.user.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-red-600">Denied Submissions</h1>
              <p className="text-muted-foreground mt-1">
                {submissions.length} {submissions.length === 1 ? 'denial' : 'denials'} today
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin/search">
                <Button variant="outline" className="gap-1">
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
              <div className="mb-4 text-6xl">📋</div>
              <h2 className="mb-2 text-2xl font-bold">No denials today</h2>
              <p className="text-muted-foreground mb-6">All denied submissions will appear here</p>
              <Link href="/admin">
                <Button>Back to Dashboard</Button>
              </Link>
            </div>
          ) : (
            <div className="-mx-4 sm:mx-0">
              <div className="overflow-x-auto rounded-none border-y border-red-200 bg-white shadow sm:rounded-lg sm:border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Patient Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Denied At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {submissions.map((submission) => (
                      <tr key={submission.id} className="transition-colors hover:bg-red-50">
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
                        <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-red-600">
                          {submission.denialEmailSentAt
                            ? formatDateWithTime(submission.denialEmailSentAt)
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
