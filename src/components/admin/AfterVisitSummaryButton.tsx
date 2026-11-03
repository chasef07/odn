'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { sendAfterVisitSummary } from '@/app/admin/_actions/after-visit-summary'

type AfterVisitSummaryButtonProps = {
  submissionId: string
  additionalInformation: string | null
  disabled?: boolean
}

export function AfterVisitSummaryButton({
  submissionId,
  additionalInformation,
  disabled = false,
}: AfterVisitSummaryButtonProps) {
  const [open, setOpen] = useState(false)
  const [includeAdditionalInformation, setIncludeAdditionalInformation] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const hasAdditionalInformation = Boolean(additionalInformation?.trim())

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setIncludeAdditionalInformation(false)
      setError(null)
      setSent(false)
    }
  }

  const handleSend = async () => {
    setIsSending(true)
    setError(null)
    try {
      const result = await sendAfterVisitSummary(submissionId, { includeAdditionalInformation })
      if (result.success) {
        setSent(true)
      } else {
        setError(result.error)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
        variant="outline"
        size="sm"
        className="h-10 sm:h-8"
      >
        After Visit Summary
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate After Visit Summary</DialogTitle>
            <DialogDescription>
              Generates the after-visit summary PDF for this chart and emails it to
              hello@onlinedoctornote.com.
            </DialogDescription>
          </DialogHeader>

          {hasAdditionalInformation && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="avs-additional-information"
                  checked={includeAdditionalInformation}
                  onCheckedChange={setIncludeAdditionalInformation}
                  disabled={isSending || sent}
                />
                <Label htmlFor="avs-additional-information" className="text-sm">
                  Include additional information
                </Label>
              </div>
              <p className="rounded-md bg-gray-50 px-3 py-2 text-sm whitespace-pre-wrap text-gray-700">
                {additionalInformation}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {sent && (
            <p className="text-sm text-green-600">
              After-visit summary sent to hello@onlinedoctornote.com.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSending}>
              {sent ? 'Close' : 'Cancel'}
            </Button>
            {!sent && (
              <Button onClick={handleSend} disabled={isSending}>
                {isSending ? 'Sending...' : 'Generate & Send'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
