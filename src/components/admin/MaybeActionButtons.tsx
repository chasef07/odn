'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApprovalDialogContent } from '@/components/admin/ApprovalDialogContent'
import { getTodayET } from '@/lib/admin-utils'
import { SelectDenialDialog } from '@/components/admin/SelectDenialDialog'
import { RemoveGuardianModeControl } from '@/components/admin/RemoveGuardianModeControl'
import { approveSubmission } from '@/app/admin/_actions/approve'
import { denySubmission } from '@/app/admin/_actions/deny'
import { markAsManual } from '@/app/admin/_actions/maybe'
import type { MaybeSubmission } from '@/app/admin/_actions/queues'

interface MaybeActionButtonsProps {
  submission: MaybeSubmission
}

export function MaybeActionButtons({ submission }: MaybeActionButtonsProps) {
  const router = useRouter()
  const submissionId = submission.id
  const [recipient, setRecipient] = useState(submission.recipient)
  const [guardianFirstName, setGuardianFirstName] = useState(submission.guardianFirstName || '')
  const [guardianLastName, setGuardianLastName] = useState(submission.guardianLastName || '')
  const [guardianDateOfBirth, setGuardianDateOfBirth] = useState(submission.guardianDateOfBirth)
  const [isLoading, setIsLoading] = useState(false)
  const [isGuardianRemovalPending, setIsGuardianRemovalPending] = useState(false)
  const isActionDisabled = isLoading || isGuardianRemovalPending

  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [evaluationDate, setEvaluationDate] = useState(getTodayET())
  const [diagnosis, setDiagnosis] = useState('')
  const [withRestrictions, setWithRestrictions] = useState(true)

  const [showDenialDialog, setShowDenialDialog] = useState(false)
  const [denialError, setDenialError] = useState<string | null>(null)

  const [showManualDialog, setShowManualDialog] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  const handleGuardianRemoved = () => {
    setRecipient('myself')
    setGuardianFirstName('')
    setGuardianLastName('')
    setGuardianDateOfBirth(null)
  }

  const handleApproveClick = () => {
    setApprovalError(null)
    setEvaluationDate(getTodayET())
    setDiagnosis('')
    setWithRestrictions(true)
    setShowApprovalDialog(true)
  }

  const handleApproveConfirm = async () => {
    setIsLoading(true)
    setApprovalError(null)

    try {
      const result = await approveSubmission(
        submissionId,
        evaluationDate,
        diagnosis || undefined,
        withRestrictions
      )

      if (result.success) {
        setShowApprovalDialog(false)
        setDiagnosis('')
        router.refresh()
      } else {
        setApprovalError(result.error || 'Unknown error')
        setIsLoading(false)
      }
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  const handleDenyClick = () => {
    setDenialError(null)
    setShowDenialDialog(true)
  }

  const handleDenyConfirm = async (reason: string) => {
    setIsLoading(true)
    setDenialError(null)

    try {
      const result = await denySubmission(submissionId, reason)

      if (result.success) {
        setShowDenialDialog(false)
        router.refresh()
      } else {
        setDenialError(result.error || 'Unknown error')
        setIsLoading(false)
      }
    } catch (err) {
      setDenialError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  const handleManualClick = () => {
    setManualError(null)
    setShowManualDialog(true)
  }

  const handleManualConfirm = async () => {
    setIsLoading(true)
    setManualError(null)

    try {
      const result = await markAsManual(submissionId)

      if (result.success) {
        setShowManualDialog(false)
        router.refresh()
      } else {
        setManualError(result.error || 'Unknown error')
        setIsLoading(false)
      }
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Link href={`/admin/maybe/${submissionId}`}>
          <Button variant="outline" size="sm" disabled={isLoading}>
            Edit
          </Button>
        </Link>
        <Button
          onClick={handleApproveClick}
          disabled={isLoading}
          variant="default"
          className="bg-green-600 hover:bg-green-700"
          size="sm"
        >
          Approve
        </Button>
        <Button onClick={handleDenyClick} disabled={isLoading} variant="destructive" size="sm">
          Deny
        </Button>
        <Button onClick={handleManualClick} disabled={isLoading} variant="secondary" size="sm">
          Manual Note
        </Button>
      </div>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Submission</DialogTitle>
            <DialogDescription>
              Confirm approval and set the evaluation date for the PDF.
            </DialogDescription>
          </DialogHeader>

          <ApprovalDialogContent
            evaluationDate={evaluationDate}
            onDateChange={setEvaluationDate}
            diagnosis={diagnosis}
            onDiagnosisChange={setDiagnosis}
            error={approvalError}
          />

          <RemoveGuardianModeControl
            submissionId={submissionId}
            patientDateOfBirth={submission.patientDateOfBirth}
            recipient={recipient}
            guardianFirstName={guardianFirstName}
            guardianLastName={guardianLastName}
            guardianDateOfBirth={guardianDateOfBirth}
            disabled={isLoading}
            onPendingChange={setIsGuardianRemovalPending}
            onRemoved={handleGuardianRemoved}
          />

          <div className="flex items-center gap-2 py-4">
            <Switch
              id="maybe-restrictions-toggle"
              checked={withRestrictions}
              onCheckedChange={setWithRestrictions}
              disabled={isActionDisabled}
            />
            <Label htmlFor="maybe-restrictions-toggle" className="text-sm">
              Include &quot;with no restrictions&quot; in PDF
            </Label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={isActionDisabled}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveConfirm}
              disabled={isActionDisabled}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Approving...' : 'Approve & Send PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SelectDenialDialog
        open={showDenialDialog}
        onOpenChange={setShowDenialDialog}
        onConfirm={handleDenyConfirm}
        isLoading={isLoading}
        error={denialError}
        title="Deny Submission"
        description="This will process a full refund and send a denial notification to the patient. This action cannot be undone."
        confirmLabel="Deny & Refund"
      />

      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Manual Note?</DialogTitle>
            <DialogDescription>
              This will move the submission to Manual Notes where you can approve or deny without
              sending automated emails. You will handle the note manually.
            </DialogDescription>
          </DialogHeader>

          {manualError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <strong>Error:</strong> {manualError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowManualDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleManualConfirm} disabled={isLoading} variant="secondary">
              {isLoading ? 'Processing...' : 'Mark as Manual'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
