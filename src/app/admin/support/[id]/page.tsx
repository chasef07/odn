import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { SupportTicketDetail } from '@/components/admin/SupportTicketDetail'
import { getSupportTicket } from '@/app/admin/support/actions'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AdminSupportDetailPage({ params }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    redirect('/admin/login')
  }

  const { id } = await params
  const result = await getSupportTicket(id)

  if (!result.ticket) {
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

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin/support"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <span className="mr-1">‹</span>
            Back to SMS Support
          </Link>
        </div>

        <SupportTicketDetail ticket={result.ticket} />
      </main>
    </div>
  )
}
