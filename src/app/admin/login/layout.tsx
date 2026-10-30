import { ReactNode } from 'react'

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <main>{children}</main>
    </div>
  )
}
