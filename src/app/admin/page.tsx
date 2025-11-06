/**
 * Admin Dashboard Page
 * Shows statistics and start reviewing button
 */

import Link from 'next/link'
import { AdminStats } from '@/components/admin/AdminStats'
import { Button } from '@/components/ui/button'
import { getDashboardStats } from './actions'

export default async function AdminDashboardPage() {
  // Fetch real stats from database
  const statsResult = await getDashboardStats()

  if (!statsResult.success || !statsResult.data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-red-600 mt-1">Failed to load dashboard stats. Please try again.</p>
        </div>
      </div>
    )
  }

  const { pendingCount, approvedToday, deniedToday, maybeCount } = statsResult.data

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage and review patient doctor note submissions
        </p>
      </div>

      {/* Stats Cards */}
      <AdminStats
        pendingCount={pendingCount}
        approvedToday={approvedToday}
        deniedToday={deniedToday}
        maybeCount={maybeCount}
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
  )
}
