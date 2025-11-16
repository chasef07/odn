'use client'

/**
 * Manual Action Buttons Component
 * Approve or Deny actions for Manual submissions (no automation - no PDF/email/refund)
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
import { approveSubmission, denySubmission } from '@/app/admin/actions'

interface ManualActionButtonsProps {
  submissionId: string
}

export function ManualActionButtons({ submissionId }: ManualActionButtonsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Approval modal state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  // Denial modal state
  const [showDenialDialog, setShowDenialDialog] = useState(false)
  const [denialReason, setDenialReason] = useState<string>('')
  const [otherReason, setOtherReason] = useState('')
  const [denialError, setDenialError] = useState<string | null>(null)

  const handleApproveClick = () => {
    setApprovalError(null)
    setShowApprovalDialog(true)
  }

  const handleApproveConfirm = async () => {
    setIsLoading(true)
    setApprovalError(null)

    try {
      const result = await approveSubmission(submissionId)

      if (result.success) {
        setShowApprovalDialog(false)
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
      </div>

      {/* Approval Confirmation Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Manual Submission</DialogTitle>
            <DialogDescription>
              This will mark the submission as approved without sending any automated emails.
              You will handle the note manually. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {approvalError && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              <strong>Error:</strong> {approvalError}
            </div>
          )}

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
              {isLoading ? 'Approving...' : 'Approve (Skip Email)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Denial Confirmation Dialog */}
      <Dialog open={showDenialDialog} onOpenChange={setShowDenialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Manual Submission</DialogTitle>
            <DialogDescription>
              This will mark the submission as denied without processing a refund or sending any emails.
              You will handle this manually. This action cannot be undone.
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
                  <SelectItem value="Insufficient Information">Insufficient Information</SelectItem>
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
              {isLoading ? 'Processing...' : 'Deny (Skip Refund)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
