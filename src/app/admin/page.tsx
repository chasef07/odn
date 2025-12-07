/**
 * Admin Dashboard Page
 * Shows statistics and start reviewing button
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { AdminStats } from '@/components/admin/AdminStats'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { getDashboardStats } from './actions'

export default async function AdminDashboardPage() {
  // SECURITY: Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  // Fetch real stats from database
  const statsResult = await getDashboardStats()

  if (!statsResult.success || !statsResult.data) {
    return (
      <div>
        {/* Header */}
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground truncate">{session.user.email}</span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-red-600 mt-1">Failed to load dashboard stats. Please try again.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const { pendingCount, approvedToday, deniedToday, maybeCount, manualCount } = statsResult.data

  return (
    <div>
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground truncate">{session.user.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Manage and review patient doctor note submissions
              </p>
            </div>
            <Link href="/admin/search">
              <Button variant="outline" className="gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search All Submissions
              </Button>
            </Link>
          </div>

          {/* Stats Cards */}
          <AdminStats
            pendingCount={pendingCount}
            approvedToday={approvedToday}
            deniedToday={deniedToday}
            maybeCount={maybeCount}
            manualCount={manualCount}
          />

          {/* Start Reviewing Button */}
          {pendingCount > 0 && (
            <div className="flex justify-center">
              <Link href="/admin/review" className="w-full sm:w-auto">
                <Button size="lg" className="h-14 w-full px-12 text-lg sm:w-auto">
                  Start Reviewing Submissions
                </Button>
              </Link>
            </div>
          )}

          {/* Empty State */}
          {pendingCount === 0 && (
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
              <p className="text-muted-foreground">
                There are no pending submissions to review at this time.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
