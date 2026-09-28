import { ReactNode } from 'react'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>
}
