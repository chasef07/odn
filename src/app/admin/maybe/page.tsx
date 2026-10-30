import Link from 'next/link'
import { Search } from 'lucide-react'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { Button } from '@/components/ui/button'
import { getMaybeSubmissions, getManualSubmissions } from '@/app/admin/_actions/queues'
import { MaybePortalTabs } from '@/components/admin/MaybePortalTabs'
import { requireAdminSession } from '@/lib/admin-session'

export default async function MaybePortalPage() {
  const admin = await requireAdminSession()

  const [maybeResult, manualResult] = await Promise.all([
    getMaybeSubmissions(),
    getManualSubmissions(),
  ])

  const maybeSubmissions = maybeResult.success ? maybeResult.submissions : []
  const manualSubmissions = manualResult.success ? manualResult.submissions : []
  const totalCount = maybeSubmissions.length + manualSubmissions.length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
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
              <h1 className="text-foreground text-2xl font-bold sm:text-3xl">Review Portal</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {totalCount} {totalCount === 1 ? 'submission' : 'submissions'} awaiting review
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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

          {(!maybeResult.success || !manualResult.success) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">
                {!maybeResult.success && (maybeResult.error || 'Failed to load maybe submissions')}
                {!maybeResult.success && !manualResult.success && ' | '}
                {!manualResult.success &&
                  (manualResult.error || 'Failed to load manual submissions')}
              </p>
            </div>
          )}

          <MaybePortalTabs
            maybeSubmissions={maybeSubmissions}
            manualSubmissions={manualSubmissions}
          />
        </div>
      </main>
    </div>
  )
}
