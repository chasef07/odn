import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { BusinessAnalyticsDashboard } from '@/components/admin/BusinessAnalyticsDashboard'
import { getBusinessAnalytics } from '@/app/admin/_actions/analytics'
import { requireAdminSession } from '@/lib/admin-session'

export default async function BusinessAnalyticsPage() {
  const admin = await requireAdminSession()

  const analyticsResult = await getBusinessAnalytics({ range: '30d' })

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
              <span className="hidden text-sm text-gray-600 sm:block">{admin.email}</span>
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
          <BusinessAnalyticsDashboard analytics={analyticsResult.data} />
        )}
      </main>
    </div>
  )
}
