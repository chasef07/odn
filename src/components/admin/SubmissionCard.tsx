/**
 * SubmissionCard Component
 * Displays detailed information about a single patient submission
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Submission } from '@prisma/client'
import {
  calculateAge,
  formatDateRange,
  calculateDaysDifference,
  formatFullDate,
  formatDateWithTime,
  formatNotePurpose,
} from '@/lib/admin-utils'

interface SubmissionCardProps {
  submission: Submission
  currentIndex: number
  totalCount: number
  diagnosis?: string
  onDiagnosisChange?: (value: string) => void
}

export function SubmissionCard({ submission, currentIndex, totalCount, diagnosis, onDiagnosisChange }: SubmissionCardProps) {
  const patientAge = calculateAge(submission.patientDateOfBirth)
  const dateRange = formatDateRange(submission.firstDayOff, submission.lastDayOff)
  const dayCount = calculateDaysDifference(submission.firstDayOff, submission.lastDayOff)
  const hasGuardian = submission.recipient === 'someone_else'

  // Parse symptoms from JSON
  const symptoms = submission.symptoms
    ? (Array.isArray(submission.symptoms) ? submission.symptoms : [])
    : []

  return (
    <Card className="mx-auto w-full max-w-2xl">
      {/* Progress indicator */}
      <CardHeader className="border-b py-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Submission Review</CardTitle>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {totalCount}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 py-3">
        {/* Patient Information */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Patient Information
          </h3>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-muted-foreground">Name: </span>
              <span>
                {submission.patientFirstName} {submission.patientLastName}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">DOB: </span>
              <span>{formatFullDate(submission.patientDateOfBirth)} (Age {patientAge})</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span>{submission.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Phone: </span>
              <span>{submission.phone}</span>
            </div>
            <div>
              <span className="text-muted-foreground">State: </span>
              <span>{submission.state}</span>
            </div>
          </div>
        </div>

        {/* Guardian Information (if applicable) */}
        {hasGuardian && submission.guardianFirstName && (
          <div className="space-y-1.5 border-t pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Guardian Information
            </h3>
            <div className="space-y-1 text-xs">
              <div>
                <span className="text-muted-foreground">Name: </span>
                <span>
                  {submission.guardianFirstName} {submission.guardianLastName}
                </span>
              </div>
              {submission.guardianDateOfBirth && (
                <div>
                  <span className="text-muted-foreground">DOB: </span>
                  <span>
                    {formatFullDate(submission.guardianDateOfBirth)} (Age{' '}
                    {calculateAge(submission.guardianDateOfBirth)})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Note Request */}
        <div className="space-y-1.5 border-t pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Note Request
          </h3>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-muted-foreground">Purpose: </span>
              <span>
                {submission.notePurpose}
                {submission.notePurpose === 'other' && submission.otherNotePurpose && (
                  <span> - {submission.otherNotePurpose}</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Dates: </span>
              <span>
                {dateRange} ({dayCount} {dayCount === 1 ? 'day' : 'days'})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Reason: </span>
              <span>
                {submission.absenceReason}
                {submission.absenceReason === 'Other' && submission.otherAbsenceReason && (
                  <span> - {submission.otherAbsenceReason}</span>
                )}
              </span>
            </div>
            {symptoms.length > 0 && (
              <div>
                <span className="text-muted-foreground">Symptoms: </span>
                <span>{symptoms.join(', ')}</span>
              </div>
            )}
            {submission.additionalInformation && (
              <div>
                <span className="text-muted-foreground">Additional Info: </span>
                <span className="italic">{submission.additionalInformation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Diagnosis (optional) */}
        {onDiagnosisChange !== undefined && (
          <div className="space-y-1.5 border-t pt-2">
            <Label htmlFor="diagnosis" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Diagnosis (optional)
            </Label>
            <Textarea
              id="diagnosis"
              value={diagnosis ?? ''}
              onChange={(e) => onDiagnosisChange(e.target.value)}
              placeholder=""
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Appears on the PDF after the medical condition text. Leave blank for default text.
            </p>
          </div>
        )}

        {/* Submitted */}
        <div className="space-y-1.5 border-t pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Submitted
          </h3>
          <p className="text-xs">{formatDateWithTime(submission.createdAt)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
