'use client'

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
import { isDenialReasonChoice, type DenialChoice, type DenialReasonChoice } from '@/db/types'
import { DENIAL_REASON_OPTIONS } from '@/lib/admin-utils'

interface SelectDenialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (denial: DenialChoice) => void
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
  const [denialReason, setDenialReason] = useState<DenialReasonChoice | null>(null)
  const [otherReason, setOtherReason] = useState('')
  const missingNote = denialReason === 'Other' && !otherReason.trim()

  useEffect(() => {
    if (open) {
      setDenialReason(null)
      setOtherReason('')
    }
  }, [open])

  const handleConfirm = () => {
    if (!denialReason || missingNote) return
    onConfirm({ reason: denialReason, note: denialReason === 'Other' ? otherReason : null })
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
            <Select
              value={denialReason ?? ''}
              onValueChange={(value) => {
                if (isDenialReasonChoice(value)) setDenialReason(value)
              }}
            >
              <SelectTrigger id="denial-reason" className="max-w-full">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {DENIAL_REASON_OPTIONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.selectLabel}
                  </SelectItem>
                ))}
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
            disabled={isLoading || !denialReason || missingNote}
            variant="destructive"
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
