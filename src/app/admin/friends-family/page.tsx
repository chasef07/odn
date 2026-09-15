/**
 * Friends & Family Analytics Page
 * Customer segmentation for the doctor10 (10% off) offer.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { FriendsFamilyAnalyticsDashboard } from '@/components/admin/FriendsFamilyAnalyticsDashboard'
import { getFriendsFamilyAnalytics } from '@/app/admin/actions'

export default async function FriendsFamilyAnalyticsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  const analyticsResult = await getFriendsFamilyAnalytics({
    segment: 'best_targets',
    limit: 50,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary rounded px-2 py-1 text-sm font-medium">
                Admin Portal
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-gray-600 sm:block">{session.user.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="mr-1 size-4" />
            Back to Dashboard
          </Link>
        </div>

        {!analyticsResult.success || !analyticsResult.data ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h1 className="text-xl font-semibold text-red-900">Failed to load analytics</h1>
            <p className="mt-2 text-sm text-red-700">
              {analyticsResult.error || 'Please refresh and try again.'}
            </p>
          </div>
        ) : (
          <FriendsFamilyAnalyticsDashboard analytics={analyticsResult.data} />
        )}
      </main>
    </div>
  )
}
