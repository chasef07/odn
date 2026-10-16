import Link from 'next/link'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { SupportTicketQueue } from '@/components/admin/SupportTicketQueue'
import { getSupportTickets } from '@/app/admin/support/_actions/tickets'
import { requireAdminSession } from '@/lib/admin-session'

interface PageProps {
  searchParams: Promise<{
    status?: string
  }>
}

export default async function AdminSupportPage({ searchParams }: PageProps) {
  const admin = await requireAdminSession()

  const params = await searchParams
  const result = await getSupportTickets(params.status)

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
            <span className="mr-1">‹</span>
            Back to Dashboard
          </Link>
        </div>

        <SupportTicketQueue tickets={result.tickets} activeStatus={params.status} />
      </main>
    </div>
  )
}
