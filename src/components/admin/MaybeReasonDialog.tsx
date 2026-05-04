'use client'

import { useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_MAYBE_REASON,
  MAYBE_REASONS,
  getMaybeReasonConfig,
  type MaybeReason,
} from '@/lib/maybe-reasons'
import type { MaybeSubmissionInput } from '@/app/admin/actions'

interface MaybeReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (input: MaybeSubmissionInput) => void
  isLoading: boolean
  error: string | null
  defaultReason?: MaybeReason
  canSendEmail?: boolean
}

export function MaybeReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  error,
  defaultReason = DEFAULT_MAYBE_REASON,
  canSendEmail = true,
}: MaybeReasonDialogProps) {
  const [reason, setReason] = useState<MaybeReason | ''>('')
  const [internalNote, setInternalNote] = useState('')

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dialog state when it opens
      setReason(defaultReason)
      setInternalNote('')
    }
  }, [defaultReason, open])

  const selectedReason = reason ? getMaybeReasonConfig(reason) : null
  const sendsEmail = selectedReason?.sendsEmail ?? false
  const willSendEmail = canSendEmail && sendsEmail

  const handleConfirm = () => {
    if (!reason) return

    onConfirm({
      reason,
      internalNote: internalNote.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to Maybe</DialogTitle>
          <DialogDescription>Select why this request needs additional review.</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="maybe-reason">Maybe Reason</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as MaybeReason)}>
              <SelectTrigger id="maybe-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {MAYBE_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReason && (
              <p className="text-muted-foreground text-sm">{selectedReason.description}</p>
            )}
          </div>

          {selectedReason && (
            <div
              className={`rounded-md border p-3 text-sm ${
                willSendEmail
                  ? 'border-blue-200 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}
            >
              {willSendEmail ? 'Email will be sent' : 'No email will be sent'}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="maybe-internal-note">Internal Note</Label>
            <Textarea
              id="maybe-internal-note"
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Optional staff note"
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !reason}
            className="border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
          >
            {isLoading
              ? 'Processing...'
              : willSendEmail
                ? 'Move to Maybe & Send Email'
                : 'Move to Maybe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
