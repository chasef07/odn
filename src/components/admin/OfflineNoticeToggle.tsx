'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  turnOffOfflineNotice,
  turnOnOfflineNotice,
} from '@/app/admin/support/_actions/offline-notice'
import { formatInstantET, instantOf } from '@/lib/dates'

export function OfflineNoticeToggle({ pausedUntil }: { pausedUntil: Date | null }) {
  const router = useRouter()
  const switchId = useId()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOn = pausedUntil === null

  const handleChange = async (turnOn: boolean) => {
    setError(null)
    setIsSaving(true)
    try {
      if (turnOn) await turnOnOfflineNotice()
      else await turnOffOfflineNotice()
      router.refresh()
    } catch (caught) {
      console.error('Failed to change the overnight auto-reply:', caught)
      setError('Could not change the overnight auto-reply. Refresh and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor={switchId} className="text-sm font-medium text-gray-900">
            Overnight auto-reply
          </Label>
          <p className="text-sm text-gray-500">
            {isOn
              ? 'On. Patients who text between 12:00 AM and 7:00 AM ET get the offline message once per night.'
              : `Off until ${formatInstantET(instantOf(pausedUntil), { includeYear: false })}. It turns back on by itself.`}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <Switch id={switchId} checked={isOn} disabled={isSaving} onCheckedChange={handleChange} />
      </div>
    </div>
  )
}
