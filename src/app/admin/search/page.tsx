/**
 * Admin Search Page
 * Search submissions by name, email, or ID
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { SearchPage } from '@/components/admin/SearchPage'
import { searchSubmissions } from '@/app/admin/actions'
import { LogoutButton } from '@/components/admin/LogoutButton'

interface PageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    page?: string
  }>
}

export default async function AdminSearchPage({ searchParams }: PageProps) {
  // Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  // Parse search params
  const params = await searchParams
  const query = params.q || ''
  const searchType = (params.type as 'name' | 'email' | 'id') || 'name'
  const page = parseInt(params.page || '1', 10)

  // Fetch initial results if query exists
  let initialResults: Awaited<ReturnType<typeof searchSubmissions>>['submissions'] = []
  let initialTotal = 0

  if (query) {
    const result = await searchSubmissions({
      query,
      searchType,
      page,
      limit: 10,
    })

    if (result.success) {
      initialResults = result.submissions || []
      initialTotal = result.total || 0
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Search Interface */}
        <SearchPage
          initialResults={initialResults}
          initialTotal={initialTotal}
          initialQuery={query}
          initialSearchType={searchType}
          initialPage={page}
        />
      </main>
    </div>
  )
}
