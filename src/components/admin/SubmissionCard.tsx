/**
 * SubmissionCard Component
 * Displays detailed information about a single patient submission
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Submission } from '@/lib/mock-submissions'
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
}

export function SubmissionCard({ submission, currentIndex, totalCount }: SubmissionCardProps) {
  const patientAge = calculateAge(submission.patientDateOfBirth)
  const dateRange = formatDateRange(submission.firstDayOff, submission.lastDayOff)
  const dayCount = calculateDaysDifference(submission.firstDayOff, submission.lastDayOff)
  const hasGuardian = submission.recipient === 'someone_else'

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
              <span className="font-medium">
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
                <span className="font-medium">
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
              <span className="font-medium">{formatNotePurpose(submission.notePurpose)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Dates: </span>
              <span>
                {dateRange} ({dayCount} {dayCount === 1 ? 'day' : 'days'})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Reason: </span>
              <span>{submission.absenceReason}</span>
            </div>
            {submission.symptoms && submission.symptoms.length > 0 && (
              <div>
                <span className="text-muted-foreground">Symptoms: </span>
                <span>{submission.symptoms.join(', ')}</span>
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
