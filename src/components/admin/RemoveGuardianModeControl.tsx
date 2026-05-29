'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { removeGuardianFromAdultSubmission } from '@/app/admin/actions'
import { calculateAge } from '@/lib/admin-utils'
import { cn } from '@/lib/utils'

type RemoveGuardianModeControlProps = {
  submissionId: string
  patientDateOfBirth: string | Date
  recipient: string
  guardianFirstName?: string | null
  guardianLastName?: string | null
  guardianDateOfBirth?: string | Date | null
  disabled?: boolean
  className?: string
  onPendingChange?: (isPending: boolean) => void
  onRemoved?: () => void
}

export function RemoveGuardianModeControl({
  submissionId,
  patientDateOfBirth,
  recipient,
  guardianFirstName,
  guardianLastName,
  guardianDateOfBirth,
  disabled = false,
  className,
  onPendingChange,
  onRemoved,
}: RemoveGuardianModeControlProps) {
  const router = useRouter()
  const switchId = useId()
  const [error, setError] = useState<string | null>(null)
  const [isRemoved, setIsRemoved] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const patientAge = calculateAge(patientDateOfBirth)
  const isMinor = patientAge < 18
  const hasGuardianMode =
    !isRemoved &&
    (recipient === 'someone_else' ||
      Boolean(guardianFirstName || guardianLastName || guardianDateOfBirth))

  if (!hasGuardianMode) return null

  const handleRemove = async () => {
    if (disabled || isRemoving) return

    if (isMinor) {
      setError('Guardian information is required for patients under 18.')
      return
    }

    setError(null)
    setIsRemoving(true)
    onPendingChange?.(true)

    try {
      const result = await removeGuardianFromAdultSubmission(submissionId)

      if (result.success) {
        setIsRemoved(true)
        onRemoved?.()
        router.refresh()
      } else {
        setError(result.error || 'Failed to remove guardian mode.')
      }
    } finally {
      setIsRemoving(false)
      onPendingChange?.(false)
    }
  }

  return (
    <div className={cn('rounded-md border border-amber-200 bg-amber-50 p-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor={switchId} className="text-sm font-semibold text-amber-950">
            Guardian mode is on
          </Label>
          <p className="text-xs leading-5 text-amber-900">
            {isMinor
              ? 'Required because patient is under 18.'
              : 'Turn this off if the patient is 18+ and accidentally submitted guardian information.'}
          </p>
          {error && <p className="text-xs font-medium text-red-700">{error}</p>}
        </div>
        <Switch
          id={switchId}
          checked
          disabled={disabled || isRemoving || isMinor}
          onCheckedChange={(checked) => {
            if (!checked) handleRemove()
          }}
          aria-label="Remove guardian mode"
        />
      </div>
    </div>
  )
}
