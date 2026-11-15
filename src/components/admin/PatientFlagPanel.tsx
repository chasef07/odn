'use client'

import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  clearPatientFlag,
  getPatientFlag,
  setPatientFlag,
} from '@/app/admin/_actions/patient-flags'
import type { PatientFlag } from '@/db/types'
import { formatInstantET, instantOf } from '@/lib/dates'

type Loaded = { flag: PatientFlag | null; error: string | null }

export function PatientFlagPanel({
  submissionId,
  className = '',
}: {
  submissionId: string
  className?: string
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    getPatientFlag(submissionId)
      .catch(() => ({ success: false as const, error: 'Failed to load patient flag' }))
      .then((result) => {
        if (!current) return
        setLoaded(
          result.success ? { flag: result.flag, error: null } : { flag: null, error: result.error }
        )
      })
    return () => {
      current = false
    }
  }, [submissionId])

  if (!loaded) {
    return <p className={`text-muted-foreground text-sm ${className}`}>Checking patient flag...</p>
  }

  if (loaded.error) {
    return <p className={`text-sm text-red-700 ${className}`}>{loaded.error}</p>
  }

  const save = async (action: () => ReturnType<typeof setPatientFlag>) => {
    setIsSaving(true)
    setSaveError(null)
    const result = await action().catch((error: unknown) => {
      console.error('Patient flag update failed:', error)
      return { success: false as const, error: 'Failed to update the flag. Please try again.' }
    })
    setIsSaving(false)
    if (!result.success) {
      setSaveError(result.error)
      return
    }
    setLoaded({ flag: result.flag, error: null })
    setIsEditing(false)
  }

  const startEditing = () => {
    setReason(loaded.flag?.reason ?? '')
    setSaveError(null)
    setIsEditing(true)
  }

  const { flag } = loaded

  return (
    <div className={`space-y-2 ${className}`}>
      {flag && (
        <div
          role="alert"
          className="flex flex-wrap items-start justify-between gap-2 rounded-md border-2 border-red-500 bg-red-50 p-3 text-sm text-red-900"
        >
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-base font-bold tracking-wide text-red-700">
              <Flag className="h-4 w-4 fill-current" />
              FLAGGED
            </p>
            {flag.reason && <p className="whitespace-pre-wrap">{flag.reason}</p>}
            <p className="text-xs text-red-800">
              Flagged by {flag.flaggedBy} on {formatInstantET(instantOf(flag.flaggedAt))}
            </p>
          </div>
          {!isEditing && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={startEditing} disabled={isSaving}>
                Edit reason
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => save(() => clearPatientFlag(submissionId))}
                disabled={isSaving}
              >
                Unflag
              </Button>
            </div>
          )}
        </div>
      )}

      {!flag && !isEditing && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={startEditing} className="gap-1 text-red-700">
            <Flag className="h-4 w-4" />
            Flag patient
          </Button>
        </div>
      )}

      {isEditing && (
        <div className="space-y-2 rounded-md border bg-white p-3">
          <Label htmlFor={`flag-reason-${submissionId}`}>Reason (optional)</Label>
          <Textarea
            id={`flag-reason-${submissionId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isSaving}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => save(() => setPatientFlag(submissionId, reason))}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save flag'}
            </Button>
          </div>
        </div>
      )}

      {saveError && <p className="text-sm text-red-700">{saveError}</p>}
    </div>
  )
}
