'use client'

/**
 * Approval Dialog Content Component
 * Reusable content for approval dialogs with evaluation date picker
 */

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface ApprovalDialogContentProps {
  evaluationDate: string
  onDateChange: (date: string) => void
  error?: string | null
  isReApproval?: boolean
}

export function ApprovalDialogContent({
  evaluationDate,
  onDateChange,
  error,
  isReApproval = false,
}: ApprovalDialogContentProps) {
  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-muted-foreground">
        {isReApproval
          ? "This will generate a NEW doctor's note PDF and send a NEW email to the patient."
          : "This will generate a doctor's note PDF and send it to the patient via email."}
      </p>

      <div className="space-y-2">
        <Label htmlFor="evaluation-date">Evaluation Date (for PDF)</Label>
        <Input
          id="evaluation-date"
          type="date"
          value={evaluationDate}
          onChange={(e) => onDateChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          This date appears as &quot;Date Issued&quot; on the PDF. Not stored in database.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  )
}

/**
 * Get today's date in YYYY-MM-DD format using local timezone
 * This ensures the default date matches what the user sees on their calendar
 */
export function getTodayLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}
