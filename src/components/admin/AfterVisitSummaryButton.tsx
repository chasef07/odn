'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { sendAfterVisitSummary } from '@/app/admin/_actions/after-visit-summary'
import {
  FREE_TEXT_ANSWER_LABELS,
  type FreeTextAnswer,
  type FreeTextChoices,
} from '@/lib/after-visit-summary'

type AfterVisitSummaryButtonProps = {
  submissionId: string
  freeTextAnswers: FreeTextChoices
  disabled?: boolean
}

export function AfterVisitSummaryButton({
  submissionId,
  freeTextAnswers,
  disabled = false,
}: AfterVisitSummaryButtonProps) {
  const [open, setOpen] = useState(false)
  const [included, setIncluded] = useState<FreeTextChoices>({})
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const answers = (Object.keys(FREE_TEXT_ANSWER_LABELS) as FreeTextAnswer[]).filter(
    (field) => freeTextAnswers[field] !== undefined
  )
  const emptyIncluded = answers.some(
    (field) => included[field] !== undefined && !included[field]?.trim()
  )

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setIncluded({})
      setError(null)
      setSent(false)
    }
  }

  const toggle = (field: FreeTextAnswer, on: boolean) => {
    setIncluded((current) => {
      const next = { ...current }
      if (on) next[field] = freeTextAnswers[field]
      else delete next[field]
      return next
    })
  }

  const handleSend = async () => {
    setIsSending(true)
    setError(null)
    try {
      const result = await sendAfterVisitSummary(submissionId, { freeText: included })
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate After Visit Summary</DialogTitle>
            <DialogDescription>
              Generates the one-page after-visit summary PDF for this chart and emails it to
              hello@onlinedoctornote.com. Edits change only this summary, not the chart.
            </DialogDescription>
          </DialogHeader>

          {answers.map((field) => {
            const label = FREE_TEXT_ANSWER_LABELS[field]
            const switchId = `avs-${field}`
            const text = included[field]
            return (
              <div key={field} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id={switchId}
                    checked={text !== undefined}
                    onCheckedChange={(on) => toggle(field, on)}
                    disabled={isSending || sent}
                  />
                  <Label htmlFor={switchId} className="text-sm">
                    Include {label.toLowerCase()}
                  </Label>
                </div>
                {text === undefined ? (
                  <p className="rounded-md bg-gray-50 px-3 py-2 text-sm whitespace-pre-wrap text-gray-700">
                    {freeTextAnswers[field]}
                  </p>
                ) : (
                  <Textarea
                    aria-label={`${label} for the summary`}
                    value={text}
                    onChange={(event) =>
                      setIncluded((current) => ({ ...current, [field]: event.target.value }))
                    }
                    disabled={isSending || sent}
                    rows={3}
                  />
                )}
              </div>
            )
          })}

          {emptyIncluded && (
            <p className="text-sm text-red-600">
              An included answer is empty. Add text or switch it off.
            </p>
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
              <Button onClick={handleSend} disabled={isSending || emptyIncluded}>
                {isSending ? 'Sending...' : 'Generate & Send'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
