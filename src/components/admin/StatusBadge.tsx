import { SubmissionStatus } from '@prisma/client'

interface StatusBadgeProps {
  status: SubmissionStatus
  size?: 'sm' | 'md'
}

const statusConfig: Record<SubmissionStatus, { label: string; className: string }> = {
  PENDING_REVIEW: {
    label: 'Pending',
    className: 'bg-blue-100 text-blue-800',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800',
  },
  DENIED: {
    label: 'Denied',
    className: 'bg-red-100 text-red-800',
  },
  MAYBE: {
    label: 'Maybe',
    className: 'bg-yellow-100 text-yellow-800',
  },
  MANUAL: {
    label: 'Manual',
    className: 'bg-purple-100 text-purple-800',
  },
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status]

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.className} ${sizeClasses}`}
    >
      {config.label}
    </span>
  )
}
