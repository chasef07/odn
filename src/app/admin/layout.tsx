/**
 * Admin Layout
 * Wrapper layout for all admin pages
 */

import Link from 'next/link'
import { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LogoutButton } from '@/components/admin/LogoutButton'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                Online Doctor Note
              </h1>
              <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary sm:text-sm">
                Admin Portal
              </span>
            </Link>

            {/* User Menu */}
            {session?.user && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {session.user.email}
                </span>
                <LogoutButton />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
