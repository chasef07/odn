'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DATE_LIMITS } from '@/lib/validation-constants'

interface ApprovalDialogContentProps {
  evaluationDate: string
  onDateChange: (date: string) => void
  diagnosis?: string
  onDiagnosisChange?: (diagnosis: string) => void
  error?: string | null
  isReApproval?: boolean
}

export function ApprovalDialogContent({
  evaluationDate,
  onDateChange,
  diagnosis,
  onDiagnosisChange,
  error,
  isReApproval = false,
}: ApprovalDialogContentProps) {
  return (
    <div className="space-y-4 py-2">
      <p className="text-muted-foreground text-sm">
        {isReApproval
          ? "This will generate a NEW doctor's note PDF and send a NEW email to the patient."
          : "This will generate a doctor's note PDF and send it to the patient via email."}
      </p>

      <div className="space-y-2">
        <Label htmlFor="evaluation-date">Evaluation Date (for PDF)</Label>
        <Input
          id="evaluation-date"
          type="date"
          min={DATE_LIMITS.EARLIEST_DAY}
          value={evaluationDate}
          onChange={(e) => onDateChange(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          This date appears as &quot;Date Issued&quot; on the PDF. Not stored in database.
        </p>
      </div>

      {onDiagnosisChange && (
        <div className="space-y-2">
          <Label htmlFor="diagnosis">Diagnosis (optional)</Label>
          <Textarea
            id="diagnosis"
            value={diagnosis || ''}
            onChange={(e) => onDiagnosisChange(e.target.value)}
            placeholder=""
            rows={2}
          />
          <p className="text-muted-foreground text-xs">
            Appears after &quot;due to a medical condition&quot; on the PDF. Leave blank for default
            text.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  )
}
