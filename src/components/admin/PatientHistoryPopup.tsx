'use client'

/**
 * Patient History Popup Component
 * Shows past submissions for the same patient in a dialog
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { getPatientHistory, type PatientHistoryEntry } from '@/app/admin/actions'
import { formatDateRange, formatDateWithTime } from '@/lib/admin-utils'

interface PatientHistoryPopupProps {
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: Date | string
  email: string
  currentSubmissionId: string
}

const NOTE_PURPOSE_LABELS: Record<string, string> = {
  work: 'Work',
  school: 'School',
  both: 'Work & School',
  travel: 'Travel',
  other: 'Other',
}

export function PatientHistoryPopup({
  patientFirstName,
  patientLastName,
  patientDateOfBirth,
  email,
  currentSubmissionId,
}: PatientHistoryPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<PatientHistoryEntry[] | null>(null)

  // Fetch history on mount so we can show the count immediately
  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true)
      const dob =
        typeof patientDateOfBirth === 'string'
          ? new Date(patientDateOfBirth + 'T12:00:00Z')
          : patientDateOfBirth

      const result = await getPatientHistory(
        patientFirstName,
        patientLastName,
        dob,
        email,
        currentSubmissionId
      )

      if (result.success && result.data) {
        setHistory(result.data)
      } else {
        setHistory([])
      }
      setIsLoading(false)
    }

    fetchHistory()
  }, [patientFirstName, patientLastName, patientDateOfBirth, email, currentSubmissionId])

  const count = history?.length ?? 0

  // Don't show anything while loading or if no history
  if (isLoading) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        ...
      </span>
    )
  }

  if (count === 0) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
      >
        {count} prior
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Patient History</DialogTitle>
            <DialogDescription>
              {count} previous {count === 1 ? 'submission' : 'submissions'} found for{' '}
              {patientFirstName} {patientLastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {history?.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={entry.status} />
                    <span className="text-gray-500">
                      {NOTE_PURPOSE_LABELS[entry.notePurpose] || entry.notePurpose}
                    </span>
                  </div>
                  <Link href={`/admin/search/${entry.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      View
                    </Button>
                  </Link>
                </div>

                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <div>
                    <span className="text-gray-400">Dates: </span>
                    {formatDateRange(entry.firstDayOff, entry.lastDayOff)}
                  </div>
                  <div>
                    <span className="text-gray-400">Email: </span>
                    {entry.email}
                  </div>
                  <div>
                    <span className="text-gray-400">Submitted: </span>
                    {formatDateWithTime(entry.createdAt)}
                  </div>
                  {entry.denialReason && (
                    <div>
                      <span className="text-gray-400">Denial reason: </span>
                      <span className="text-red-600">{entry.denialReason}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
