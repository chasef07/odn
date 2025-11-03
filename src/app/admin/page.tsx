'use client'

/**
 * Admin Dashboard Page
 * Shows statistics and start reviewing button
 */

import { useState } from 'react'
import Link from 'next/link'
import { AdminStats } from '@/components/admin/AdminStats'
import { Button } from '@/components/ui/button'
import { mockSubmissions } from '@/lib/mock-submissions'

export default function AdminDashboardPage() {
  // In real app, this would come from database/API
  const [submissions] = useState(mockSubmissions)

  // Calculate stats
  const pendingCount = submissions.filter((s) => s.status === 'pending_review').length

  // For now, these are 0 (will be updated as user reviews)
  const approvedToday = 0
  const deniedToday = 0

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
