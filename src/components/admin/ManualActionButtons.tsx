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
import { SelectDenialDialog } from '@/components/admin/SelectDenialDialog'
import { approveSubmission } from '@/app/admin/_actions/approve'
import { denySubmission } from '@/app/admin/_actions/deny'

interface ManualActionButtonsProps {
  submissionId: string
}

export function ManualActionButtons({ submissionId }: ManualActionButtonsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  const [showDenialDialog, setShowDenialDialog] = useState(false)
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
      </div>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Manual Submission</DialogTitle>
            <DialogDescription>
              This will mark the submission as approved without sending any automated emails. You
              will handle the note manually. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {approvalError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
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

      <SelectDenialDialog
        open={showDenialDialog}
        onOpenChange={setShowDenialDialog}
        onConfirm={handleDenyConfirm}
        isLoading={isLoading}
        error={denialError}
        title="Deny Manual Submission"
        description="This will mark the submission as denied without processing a refund or sending any emails. You will handle this manually. This action cannot be undone."
        confirmLabel="Deny (Skip Refund)"
      />
    </>
  )
}
