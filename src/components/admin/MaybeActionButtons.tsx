'use client'

/**
 * Maybe Action Buttons Component
 * Approve, Deny, or Edit actions for Maybe submissions
 */

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ApprovalDialogContent, getTodayLocal } from '@/components/admin/ApprovalDialogContent'
import { approveSubmission, denySubmission, markAsManual } from '@/app/admin/actions'

interface MaybeActionButtonsProps {
  submissionId: string
}

export function MaybeActionButtons({ submissionId }: MaybeActionButtonsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Approval modal state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [evaluationDate, setEvaluationDate] = useState(getTodayLocal())
  const [diagnosis, setDiagnosis] = useState('')
  const [withRestrictions, setWithRestrictions] = useState(true)

  // Denial modal state
  const [showDenialDialog, setShowDenialDialog] = useState(false)
  const [denialReason, setDenialReason] = useState<string>('')
  const [otherReason, setOtherReason] = useState('')
  const [denialError, setDenialError] = useState<string | null>(null)

  // Manual note modal state
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)

  const handleApproveClick = () => {
    setApprovalError(null)
    setEvaluationDate(getTodayLocal())
    setDiagnosis('')
    setWithRestrictions(true) // Reset to default when opening dialog
    setShowApprovalDialog(true)
  }

  const handleApproveConfirm = async () => {
    setIsLoading(true)
    setApprovalError(null)

    try {
      const result = await approveSubmission(submissionId, evaluationDate, diagnosis || undefined, withRestrictions)

      if (result.success) {
        setShowApprovalDialog(false)
        setDiagnosis('')
        router.refresh() // Refresh to remove from list
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
    setDenialReason('')
    setOtherReason('')
    setDenialError(null)
    setShowDenialDialog(true)
  }

  const handleDenyConfirm = async () => {
    const finalReason = denialReason === 'Other' ? otherReason : denialReason

    if (!finalReason) {
      setDenialError('Please select or enter a denial reason')
      return
    }

    setIsLoading(true)
    setDenialError(null)

    try {
      const result = await denySubmission(submissionId, finalReason)

      if (result.success) {
        setShowDenialDialog(false)
        router.refresh() // Refresh to remove from list
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
        router.refresh() // Refresh to move to manual notes tab
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
        <Button
          onClick={handleDenyClick}
          disabled={isLoading}
          variant="destructive"
          size="sm"
        >
          Deny
        </Button>
        <Button
          onClick={handleManualClick}
          disabled={isLoading}
          variant="secondary"
          size="sm"
        >
          Manual Note
        </Button>
      </div>

      {/* Approval Confirmation Dialog */}
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

          <div className="flex items-center gap-2 py-4">
            <Switch
              id="maybe-restrictions-toggle"
              checked={withRestrictions}
              onCheckedChange={setWithRestrictions}
              disabled={isLoading}
            />
            <Label htmlFor="maybe-restrictions-toggle" className="text-sm">
              Include &quot;with no restrictions&quot; in PDF
            </Label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveConfirm}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Approving...' : 'Approve & Send PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Denial Confirmation Dialog */}
      <Dialog open={showDenialDialog} onOpenChange={setShowDenialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Submission</DialogTitle>
            <DialogDescription>
              This will process a full refund and send a denial notification to the patient.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {denialError && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <strong>Error:</strong> {denialError}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="denial-reason">Reason for Denial</Label>
              <Select value={denialReason} onValueChange={setDenialReason}>
                <SelectTrigger id="denial-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Legal">Legal - Cannot provide note for this situation</SelectItem>
                  <SelectItem value="7+ days">7+ days - Absence period exceeds 7 days</SelectItem>
                  <SelectItem value="Duplicate">Duplicate - Patient submitted twice</SelectItem>
                  <SelectItem value="Refund">Refund</SelectItem>
                  <SelectItem value="Under 18">Under 18 - Patient is a minor</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {denialReason === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor="other-reason">Please specify</Label>
                <Input
                  id="other-reason"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Enter reason for denial"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDenialDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDenyConfirm}
              disabled={isLoading || !denialReason || (denialReason === 'Other' && !otherReason)}
              variant="destructive"
            >
              {isLoading ? 'Processing...' : 'Deny & Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Note Confirmation Dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Manual Note?</DialogTitle>
            <DialogDescription>
              This will move the submission to Manual Notes where you can approve or deny without sending automated emails.
              You will handle the note manually.
            </DialogDescription>
          </DialogHeader>

          {manualError && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
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
            <Button
              onClick={handleManualConfirm}
              disabled={isLoading}
              variant="secondary"
            >
              {isLoading ? 'Processing...' : 'Mark as Manual'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
