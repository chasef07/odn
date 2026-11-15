import { ReactNode } from 'react'
import { AdminSessionRefresh } from '@/components/admin/AdminSessionRefresh'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <AdminSessionRefresh />
      {children}
    </div>
  )
}
