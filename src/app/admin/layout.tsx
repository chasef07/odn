import { ReactNode } from 'react'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-white">{children}</div>
}
