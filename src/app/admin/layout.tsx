/**
 * Admin Layout
 * Wrapper layout for all admin pages
 */

import Link from 'next/link'
import { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
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

            {/* Optional: Add navigation or user menu here */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
