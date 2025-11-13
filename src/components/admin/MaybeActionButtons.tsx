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
import { approveSubmission, denySubmission } from '@/app/admin/actions'

interface MaybeActionButtonsProps {
  submissionId: string
}

export function MaybeActionButtons({ submissionId }: MaybeActionButtonsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Approval modal state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)

  // Denial modal state
  const [showDenialDialog, setShowDenialDialog] = useState(false)
  const [denialReason, setDenialReason] = useState<string>('')
  const [otherReason, setOtherReason] = useState('')

  const handleApproveClick = () => {
    setShowApprovalDialog(true)
  }

  const handleApproveConfirm = async () => {
    setIsLoading(true)
    try {
      const result = await approveSubmission(submissionId)

      if (result.success) {
        setShowApprovalDialog(false)
        router.refresh() // Refresh to remove from list
      } else {
        alert(`Failed to approve: ${result.error || 'Unknown error'}`)
      }
    } catch (err) {
      alert('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDenyClick = () => {
    setDenialReason('')
    setOtherReason('')
    setShowDenialDialog(true)
  }

  const handleDenyConfirm = async () => {
    const finalReason = denialReason === 'Other' ? otherReason : denialReason

    if (!finalReason) {
      alert('Please select or enter a denial reason')
      return
    }

    setIsLoading(true)
    try {
      const result = await denySubmission(submissionId, finalReason)

      if (result.success) {
        setShowDenialDialog(false)
        router.refresh() // Refresh to remove from list
      } else {
        alert(`Failed to deny: ${result.error || 'Unknown error'}`)
      }
    } catch (err) {
      alert('An unexpected error occurred')
    } finally {
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
            <DialogTitle>Approve Submission</DialogTitle>
            <DialogDescription>
              This will generate a doctor's note PDF and send it to the patient via email.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
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
              {isLoading ? 'Processing...' : 'Deny & Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
