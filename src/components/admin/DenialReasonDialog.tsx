'use client'

/**
 * Denial Reason Dialog Component
 * Pop-up for selecting denial reason when doctor denies a submission
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DenialReason } from '@/lib/admin-utils'

interface DenialReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: DenialReason) => void
}

const DENIAL_REASONS: { value: DenialReason; label: string; description: string }[] = [
  {
    value: 'Legal',
    label: 'Jury Duty/Legal Matter',
    description: 'Request is for jury duty, court, or legal obligation (not medical)',
  },
  {
    value: '7+ days',
    label: 'Exceeds 7-Day Limit',
    description: 'Request exceeds the 7-day absence limit',
  },
  {
    value: 'Duplicate',
    label: 'Duplicate Submission',
    description: 'Patient submitted the intake form twice',
  },
  {
    value: 'Refund',
    label: 'Refund',
    description: 'Process refund for customer',
  },
  {
    value: 'Under 18',
    label: 'Under 18',
    description: 'Patient is under 18 years old (minor using parent/guardian info)',
  },
  {
    value: 'Other',
    label: 'Other Reason',
    description: 'Other reason for denial',
  },
]

export function DenialReasonDialog({ open, onOpenChange, onConfirm }: DenialReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState<DenialReason>('Other')

  const handleConfirm = () => {
    onConfirm(selectedReason)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setSelectedReason('Other')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Denial Reason</DialogTitle>
          <DialogDescription>
            Please select the reason for denying this submission.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={selectedReason}
            onValueChange={(value) => setSelectedReason(value as DenialReason)}
          >
            <div className="space-y-4">
              {DENIAL_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={reason.value} id={reason.value} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={reason.value} className="cursor-pointer font-medium">
                      {reason.label}
                    </Label>
                    <p className="text-muted-foreground mt-1 text-sm">{reason.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Confirm Denial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
