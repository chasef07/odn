/**
 * SubmissionCard Component
 * Displays detailed information about a single patient submission
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PatientHistoryPopup } from '@/components/admin/PatientHistoryPopup'
import { RemoveGuardianModeControl } from '@/components/admin/RemoveGuardianModeControl'
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
  evaluationDate?: string
  onEvaluationDateChange?: (value: string) => void
  diagnosis?: string
  onDiagnosisChange?: (value: string) => void
  withRestrictions?: boolean
  onWithRestrictionsChange?: (value: boolean) => void
  onGuardianRemovalPendingChange?: (isPending: boolean) => void
  onGuardianRemoved?: () => void
}

export function SubmissionCard({
  submission,
  currentIndex,
  totalCount,
  evaluationDate,
  onEvaluationDateChange,
  diagnosis,
  onDiagnosisChange,
  withRestrictions,
  onWithRestrictionsChange,
  onGuardianRemovalPendingChange,
  onGuardianRemoved,
}: SubmissionCardProps) {
  const patientAge = calculateAge(submission.patientDateOfBirth)
  const dateRange = formatDateRange(submission.firstDayOff, submission.lastDayOff)
  const dayCount = calculateDaysDifference(submission.firstDayOff, submission.lastDayOff)
  const hasGuardian = submission.recipient === 'someone_else'

  // Parse symptoms from JSON
  const symptoms = submission.symptoms
    ? Array.isArray(submission.symptoms)
      ? submission.symptoms
      : []
    : []

  return (
    <Card className="mx-auto w-full max-w-2xl">
      {/* Progress indicator */}
      <CardHeader className="border-b py-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Submission Review</CardTitle>
          <span className="text-muted-foreground text-xs">
            {currentIndex + 1} of {totalCount}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 py-3">
        {/* Patient Information */}
        <div className="space-y-1.5">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Patient Information
          </h3>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Name: </span>
              <span>
                {submission.patientFirstName} {submission.patientLastName}
              </span>
              <PatientHistoryPopup
                patientFirstName={submission.patientFirstName}
                patientLastName={submission.patientLastName}
                patientDateOfBirth={submission.patientDateOfBirth}
                email={submission.email}
                currentSubmissionId={submission.id}
              />
            </div>
            <div>
              <span className="text-muted-foreground">DOB: </span>
              <span>
                {formatFullDate(submission.patientDateOfBirth)} (Age {patientAge})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <a href={`mailto:${submission.email}`} className="text-blue-600 hover:underline">
                {submission.email}
              </a>
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
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
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

        <RemoveGuardianModeControl
          submissionId={submission.id}
          patientDateOfBirth={submission.patientDateOfBirth}
          recipient={submission.recipient}
          guardianFirstName={submission.guardianFirstName}
          guardianLastName={submission.guardianLastName}
          guardianDateOfBirth={submission.guardianDateOfBirth}
          onPendingChange={onGuardianRemovalPendingChange}
          onRemoved={onGuardianRemoved}
        />

        {/* Note Request */}
        <div className="space-y-1.5 border-t pt-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
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

        {/* PDF Options */}
        {(onEvaluationDateChange || onDiagnosisChange || onWithRestrictionsChange) && (
          <div className="space-y-2 border-t pt-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              PDF Options
            </h3>

            {/* Evaluation Date */}
            {onEvaluationDateChange && (
              <div className="space-y-1">
                <Label htmlFor="evaluationDate" className="text-muted-foreground text-xs">
                  Evaluation Date
                </Label>
                <Input
                  id="evaluationDate"
                  type="date"
                  value={evaluationDate ?? ''}
                  onChange={(e) => onEvaluationDateChange(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Diagnosis */}
            {onDiagnosisChange && (
              <div className="space-y-1">
                <Label htmlFor="diagnosis" className="text-muted-foreground text-xs">
                  Diagnosis (optional)
                </Label>
                <Textarea
                  id="diagnosis"
                  value={diagnosis ?? ''}
                  onChange={(e) => onDiagnosisChange(e.target.value)}
                  placeholder=""
                  rows={2}
                  className="text-sm"
                />
              </div>
            )}

            {/* Restrictions Toggle */}
            {onWithRestrictionsChange && (
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="card-restrictions-toggle"
                  checked={withRestrictions ?? true}
                  onCheckedChange={onWithRestrictionsChange}
                />
                <Label htmlFor="card-restrictions-toggle" className="text-muted-foreground text-xs">
                  Include &quot;with no restrictions&quot; in PDF
                </Label>
              </div>
            )}
          </div>
        )}

        {/* Submitted */}
        <div className="space-y-1.5 border-t pt-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Submitted
          </h3>
          <p className="text-xs">{formatDateWithTime(submission.createdAt)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
