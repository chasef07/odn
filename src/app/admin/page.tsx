import Link from 'next/link'
import { BarChart3, HeartHandshake, MessageSquare, Search } from 'lucide-react'
import { AdminStats } from '@/components/admin/AdminStats'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { getDashboardStats } from '@/app/admin/_actions/queues'
import { requireAdminSession } from '@/lib/admin-session'

export default async function AdminDashboardPage() {
  const admin = await requireAdminSession()

  const statsResult = await getDashboardStats()

  if (!statsResult.success || !statsResult.data) {
    return (
      <div>
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground truncate text-sm">{admin.email}</span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div>
              <h1 className="text-foreground text-3xl font-bold">Dashboard</h1>
              <p className="mt-1 text-red-600">Failed to load dashboard stats. Please try again.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const {
    pendingCount,
    approvedToday,
    deniedToday,
    maybeCount,
    manualCount,
    needsAdminSupportCount = 0,
  } = statsResult.data

  return (
    <div>
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground truncate text-sm">{admin.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-foreground text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Manage and review patient doctor note submissions
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/admin/analytics">
                <Button variant="outline" className="w-full gap-2 sm:w-auto">
                  <BarChart3 data-icon="inline-start" />
                  Business Analytics
                </Button>
              </Link>
              <Link href="/admin/friends-family">
                <Button variant="outline" className="w-full gap-2 sm:w-auto">
                  <HeartHandshake data-icon="inline-start" />
                  Friends &amp; Family Analytics
                </Button>
              </Link>
              <Link href="/admin/search">
                <Button variant="outline" className="w-full gap-2 sm:w-auto">
                  <Search data-icon="inline-start" />
                  Search All Submissions
                </Button>
              </Link>
              <Link href="/admin/support">
                <Button variant="outline" className="relative w-full gap-2 sm:w-auto">
                  <MessageSquare data-icon="inline-start" />
                  SMS Support
                  {needsAdminSupportCount > 0 && (
                    <span
                      aria-label={`${needsAdminSupportCount} support tickets need admin attention`}
                      className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white"
                    >
                      {needsAdminSupportCount > 99 ? '99+' : needsAdminSupportCount}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>

          <AdminStats
            pendingCount={pendingCount}
            approvedToday={approvedToday}
            deniedToday={deniedToday}
            maybeCount={maybeCount}
            manualCount={manualCount}
          />

          {pendingCount > 0 && (
            <div className="flex justify-center">
              <Link href="/admin/review" className="w-full sm:w-auto">
                <Button size="lg" className="h-14 w-full px-12 text-lg sm:w-auto">
                  Start Reviewing Submissions
                </Button>
              </Link>
            </div>
          )}

          {pendingCount === 0 && (
            <div className="py-8 text-center">
              <h2 className="mb-2 text-2xl font-bold">All Caught Up!</h2>
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
