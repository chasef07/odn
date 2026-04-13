'use client'

/**
 * Select Denial Dialog Component
 * Shared denial dialog with Select dropdown and custom "Other" input
 * Used by MaybeActionButtons and ManualActionButtons
 */

import { useState, useEffect } from 'react'
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

interface SelectDenialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  isLoading: boolean
  error: string | null
  title: string
  description: string
  confirmLabel: string
}

export function SelectDenialDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  error,
  title,
  description,
  confirmLabel,
}: SelectDenialDialogProps) {
  const [denialReason, setDenialReason] = useState<string>('')
  const [otherReason, setOtherReason] = useState('')

  // Reset state when dialog opens — intentional prop-driven reset
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDenialReason('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOtherReason('')
    }
  }, [open])

  const handleConfirm = () => {
    const finalReason = denialReason === 'Other' ? otherReason : denialReason
    if (finalReason) {
      onConfirm(finalReason)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Error:</strong> {error}
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
                <SelectItem value="Legal">
                  Legal - Cannot provide note for this situation
                </SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !denialReason || (denialReason === 'Other' && !otherReason)}
            variant="destructive"
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
