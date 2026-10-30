import { ReactNode } from 'react'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { requireAdminSession } from '@/lib/admin-session'

export default async function AdminReviewLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminSession()

  return (
    <div>
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
      <main className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
    </div>
  )
}
