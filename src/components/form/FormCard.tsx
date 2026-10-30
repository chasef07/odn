import { ReactNode } from 'react'

interface FormCardProps {
  children: ReactNode

  spacing?: 'space-y-2' | 'space-y-3' | 'space-y-4' | 'space-y-6'

  className?: string
}

export function FormCard({ children, spacing = 'space-y-6', className = '' }: FormCardProps) {
  return (
    <div
      className={`border-border/40 rounded-xl border bg-white p-4 shadow-sm sm:p-6 ${spacing} ${className}`}
    >
      {children}
    </div>
  )
}
