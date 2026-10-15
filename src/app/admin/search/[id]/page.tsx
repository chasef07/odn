import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getSubmissionById } from '@/app/admin/_actions/search'
import { SearchSubmissionDetail } from '@/components/admin/SearchSubmissionDetail'
import { LogoutButton } from '@/components/admin/LogoutButton'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AdminSearchDetailPage({ params }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  const { id } = await params
  const result = await getSubmissionById(id)

  if (!result.success || !result.submission) {
    notFound()
  }

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

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin/search"
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
            Back to Search
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {result.submission.patientFirstName} {result.submission.patientLastName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Submission ID: {result.submission.id.slice(0, 12)}...
          </p>
        </div>

        <SearchSubmissionDetail submission={result.submission} />
      </main>
    </div>
  )
}
