/**
 * Admin Login Layout
 * Simple layout for login page - bypasses parent admin layout auth
 */

import { ReactNode } from 'react'

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <main>{children}</main>
    </div>
  )
}
