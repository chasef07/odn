import { ReactNode } from 'react'

interface FormCardProps {
  children: ReactNode

  spacing?: 'space-y-2' | 'space-y-3' | 'space-y-4' | 'space-y-5' | 'space-y-6'

  className?: string
}

export function FormCard({ children, spacing = 'space-y-5', className = '' }: FormCardProps) {
  return (
    <div
      className={`md:border-border/60 md:rounded-xl md:border md:bg-white md:p-6 md:shadow-sm ${spacing} ${className}`}
    >
      {children}
    </div>
  )
}
