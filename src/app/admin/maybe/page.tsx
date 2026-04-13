/**
 * Maybe Portal Page
 * Shows table of all MAYBE submissions
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Search } from 'lucide-react'
import { auth } from '@/lib/auth'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { Button } from '@/components/ui/button'
import { getMaybeSubmissions, getManualSubmissions } from '../actions'
import { MaybePortalTabs } from '@/components/admin/MaybePortalTabs'

export default async function MaybePortalPage() {
  // SECURITY: Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  // Fetch all maybe and manual submissions
  const [maybeResult, manualResult] = await Promise.all([
    getMaybeSubmissions(),
    getManualSubmissions(),
  ])

  const maybeSubmissions = maybeResult.success ? maybeResult.submissions : []
  const manualSubmissions = manualResult.success ? manualResult.submissions : []
  const totalCount = maybeSubmissions.length + manualSubmissions.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-3xl font-bold">Review Portal</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {totalCount} {totalCount === 1 ? 'submission' : 'submissions'} awaiting review
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

          {/* Error state */}
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

          {/* Tabs Component */}
          <MaybePortalTabs
            maybeSubmissions={maybeSubmissions}
            manualSubmissions={manualSubmissions}
          />
        </div>
      </main>
    </div>
  )
}
