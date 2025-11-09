/**
 * Admin Layout
 * Root wrapper for all admin pages
 *
 * SECURITY NOTE: This layout does NOT check authentication to avoid redirect loops.
 * Auth checks are performed in individual page layouts:
 * - /admin/page.tsx (dashboard) - has auth check
 * - /admin/review/layout.tsx - has auth check
 * - /admin/login - no auth check (public)
 */

import Link from 'next/link'
import { ReactNode } from 'react'
import { LogoutButton } from '@/components/admin/LogoutButton'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Note: Authentication check is handled in each page's Server Component
  // This layout only provides the UI structure

  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  )
}
