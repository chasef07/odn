'use client'

/**
 * Search Submission Detail Component
 * Full view and edit interface for a submission found via search
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { PatientHistoryPopup } from '@/components/admin/PatientHistoryPopup'
import { MaybeReasonDialog } from '@/components/admin/MaybeReasonDialog'
import { AVAILABLE_STATES, ABSENCE_REASONS, NOTE_PURPOSES } from '@/lib/form-constants'
import { calculateDaysDifference } from '@/lib/admin-utils'
import { DATES_EXCEED_ALLOWED_RANGE_REASON } from '@/lib/maybe-reasons'
import {
  updateSubmission,
  approveSubmission,
  reApproveSubmission,
  denySubmission,
  changeSubmissionStatus,
  type FormattedSubmission,
  type MaybeSubmissionInput,
} from '@/app/admin/actions'
import { SubmissionStatus } from '@prisma/client'

interface SearchSubmissionDetailProps {
  submission: FormattedSubmission
}

// Helper function to parse YYYY-MM-DD string to Date at noon UTC
function parseDateSafe(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

export function SearchSubmissionDetail({ submission }: SearchSubmissionDetailProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Dialog states
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [showDenialDialog, setShowDenialDialog] = useState(false)
  const [showMaybeDialog, setShowMaybeDialog] = useState(false)
  const [showManualDialog, setShowManualDialog] = useState(false)
  const [denialReason, setDenialReason] = useState('')
  const [otherDenialReason, setOtherDenialReason] = useState('')
  const [maybeError, setMaybeError] = useState<string | null>(null)

  // Form state
  const [patientFirstName, setPatientFirstName] = useState(submission.patientFirstName)
  const [patientLastName, setPatientLastName] = useState(submission.patientLastName)
  const [patientDateOfBirth, setPatientDateOfBirth] = useState(
    submission.patientDateOfBirth as string
  )
  const [guardianFirstName, setGuardianFirstName] = useState(submission.guardianFirstName || '')
  const [guardianLastName, setGuardianLastName] = useState(submission.guardianLastName || '')
  const [guardianDateOfBirth, setGuardianDateOfBirth] = useState(
    (submission.guardianDateOfBirth as string | null) || ''
  )
  const [email, setEmail] = useState(submission.email)
  const [phone, setPhone] = useState(submission.phone)
  const [state, setState] = useState(submission.state)
  const [notePurpose, setNotePurpose] = useState(submission.notePurpose)
  const [otherNotePurpose, setOtherNotePurpose] = useState(submission.otherNotePurpose || '')
  const [firstDayOff, setFirstDayOff] = useState(submission.firstDayOff as string)
  const [lastDayOff, setLastDayOff] = useState(submission.lastDayOff as string)
  const [absenceReason, setAbsenceReason] = useState(submission.absenceReason)
  const [otherAbsenceReason, setOtherAbsenceReason] = useState(submission.otherAbsenceReason || '')
  const [symptoms, setSymptoms] = useState<string[]>(
    Array.isArray(submission.symptoms) ? (submission.symptoms as string[]) : []
  )
  const [otherSymptomText, setOtherSymptomText] = useState(submission.otherSymptomText || '')
  const [additionalInformation, setAdditionalInformation] = useState(
    submission.additionalInformation || ''
  )

  // Evaluation date for PDF (ephemeral - not stored in database)
  // Use toLocaleDateString('en-CA') to get YYYY-MM-DD in local time (not UTC)
  const [evaluationDate, setEvaluationDate] = useState<string>(
    new Date().toLocaleDateString('en-CA')
  )

  // Diagnosis for PDF (ephemeral - not stored in database)
  const [diagnosis, setDiagnosis] = useState('')

  // Restrictions toggle for PDF (ephemeral - not stored in database)
  const [withRestrictions, setWithRestrictions] = useState(true)
  const suggestedMaybeReason =
    calculateDaysDifference(firstDayOff, lastDayOff) > 7
      ? DATES_EXCEED_ALLOWED_RANGE_REASON
      : undefined
  const latestNoteVerification = submission.noteVerifications[0]

  const handleSave = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await updateSubmission(submission.id, {
        patientFirstName,
        patientLastName,
        patientDateOfBirth: parseDateSafe(patientDateOfBirth),
        guardianFirstName: guardianFirstName || null,
        guardianLastName: guardianLastName || null,
        guardianDateOfBirth: guardianDateOfBirth ? parseDateSafe(guardianDateOfBirth) : null,
        email,
        phone,
        state,
        notePurpose,
        otherNotePurpose: otherNotePurpose || null,
        firstDayOff: parseDateSafe(firstDayOff),
        lastDayOff: parseDateSafe(lastDayOff),
        absenceReason,
        otherAbsenceReason: otherAbsenceReason || null,
        symptoms,
        otherSymptomText: otherSymptomText || null,
        additionalInformation: additionalInformation || null,
      })

      if (result.success) {
        setSuccess('Changes saved successfully!')
        setIsEditing(false)
        router.refresh()
      } else {
        setError(result.error || 'Failed to save changes')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Branch on current status:
      //   - APPROVED: call reApproveSubmission to regenerate the PDF and resend
      //     the email. approveSubmission rejects already-approved submissions,
      //     so wiring the button to it silently did nothing for the patient.
      //   - Otherwise: call approveSubmission as usual.
      const isReApproval = submission.status === SubmissionStatus.APPROVED
      const result = isReApproval
        ? await reApproveSubmission(
            submission.id,
            evaluationDate,
            diagnosis || undefined,
            withRestrictions
          )
        : await approveSubmission(
            submission.id,
            evaluationDate,
            diagnosis || undefined,
            withRestrictions
          )

      if (result.success) {
        setShowApprovalDialog(false)
        setSuccess(
          result.warning ||
            (isReApproval
              ? 'Submission re-approved successfully!'
              : 'Submission approved successfully!')
        )
        router.refresh()
      } else {
        setError(result.error || 'Failed to approve')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeny = async () => {
    const finalReason = denialReason === 'Other' ? otherDenialReason : denialReason

    if (!finalReason) {
      setError('Please select or enter a denial reason')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Use changeSubmissionStatus for already approved submissions
      const result =
        submission.status === SubmissionStatus.APPROVED
          ? await changeSubmissionStatus(submission.id, SubmissionStatus.DENIED, finalReason)
          : await denySubmission(submission.id, finalReason)

      if (result.success) {
        setShowDenialDialog(false)
        setSuccess(result.warning || 'Submission denied successfully!')
        router.refresh()
      } else {
        setError(result.error || 'Failed to deny')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMaybe = async (input: MaybeSubmissionInput) => {
    setIsLoading(true)
    setMaybeError(null)

    try {
      const result = await changeSubmissionStatus(
        submission.id,
        SubmissionStatus.MAYBE,
        undefined,
        input
      )

      if (result.success) {
        setShowMaybeDialog(false)
        setSuccess(result.warning || 'Submission marked as Maybe!')
        router.refresh()
      } else {
        setMaybeError(result.error || 'Failed to mark as maybe')
      }
    } catch {
      setMaybeError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManual = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await changeSubmissionStatus(submission.id, SubmissionStatus.MANUAL)

      if (result.success) {
        setShowManualDialog(false)
        setSuccess('Submission marked as Manual!')
        router.refresh()
      } else {
        setError(result.error || 'Failed to mark as manual')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyVerificationUrl = async () => {
    if (!latestNoteVerification) return

    const url = `${window.location.origin}/verify/${latestNoteVerification.verificationSlug}`
    await navigator.clipboard.writeText(url)
    setSuccess('Verification URL copied.')
  }

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Determine which action buttons to show based on current status
  const showApproveButton = true // Can always re-approve or approve
  const showDenyButton = submission.status !== SubmissionStatus.DENIED
  const showMaybeButton = submission.status !== SubmissionStatus.MAYBE
  const showManualButton = submission.status !== SubmissionStatus.MANUAL

  const approveButtonText =
    submission.status === SubmissionStatus.APPROVED ? 'Re-Approve' : 'Approve'
  const approveDialogTitle =
    submission.status === SubmissionStatus.APPROVED
      ? 'Re-Approve Submission?'
      : 'Approve Submission?'
  const approveDialogDescription =
    submission.status === SubmissionStatus.APPROVED
      ? "This will generate a NEW doctor's note PDF and send a NEW email to the patient. Use this if you made edits that need to be reflected in the note."
      : "This will generate a doctor's note PDF and send it to the patient via email."

  return (
    <div className="space-y-6">
      {/* Status & Actions Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">Current Status:</span>
            <StatusBadge status={submission.status} size="md" />
          </div>
          <div className="flex flex-wrap gap-2">
            {showApproveButton && (
              <Button
                onClick={() => setShowApprovalDialog(true)}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
                size="sm"
              >
                {approveButtonText}
              </Button>
            )}
            {showDenyButton && (
              <Button
                onClick={() => {
                  setDenialReason('')
                  setOtherDenialReason('')
                  setShowDenialDialog(true)
                }}
                disabled={isLoading}
                variant="destructive"
                size="sm"
              >
                Deny
              </Button>
            )}
            {showMaybeButton && (
              <Button
                onClick={() => {
                  setMaybeError(null)
                  setShowMaybeDialog(true)
                }}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
              >
                Maybe
              </Button>
            )}
            {showManualButton && (
              <Button
                onClick={() => setShowManualDialog(true)}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="border-purple-500 text-purple-700 hover:bg-purple-50"
              >
                Manual
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {/* Edit/View Toggle */}
      <div className="flex justify-end">
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            Edit Fields
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => setIsEditing(false)} variant="outline" disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {/* Form Sections */}
      <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        {/* Patient Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Patient Information</h2>
            <PatientHistoryPopup
              patientFirstName={submission.patientFirstName}
              patientLastName={submission.patientLastName}
              patientDateOfBirth={submission.patientDateOfBirth}
              email={submission.email}
              currentSubmissionId={submission.id}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>First Name</Label>
              {isEditing ? (
                <Input
                  value={patientFirstName}
                  onChange={(e) => setPatientFirstName(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">{patientFirstName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              {isEditing ? (
                <Input
                  value={patientLastName}
                  onChange={(e) => setPatientLastName(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">{patientLastName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={patientDateOfBirth}
                  onChange={(e) => setPatientDateOfBirth(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">{patientDateOfBirth}</p>
              )}
            </div>
          </div>
        </div>

        {/* Guardian Information */}
        {(guardianFirstName || guardianLastName || submission.recipient === 'someone_else') && (
          <div className="space-y-4 border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900">Guardian Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                {isEditing ? (
                  <Input
                    value={guardianFirstName}
                    onChange={(e) => setGuardianFirstName(e.target.value)}
                    disabled={isLoading}
                  />
                ) : (
                  <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                    {guardianFirstName || 'N/A'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                {isEditing ? (
                  <Input
                    value={guardianLastName}
                    onChange={(e) => setGuardianLastName(e.target.value)}
                    disabled={isLoading}
                  />
                ) : (
                  <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                    {guardianLastName || 'N/A'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={guardianDateOfBirth}
                    onChange={(e) => setGuardianDateOfBirth(e.target.value)}
                    disabled={isLoading}
                  />
                ) : (
                  <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                    {guardianDateOfBirth || 'N/A'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              {isEditing ? (
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                  <a href={`mailto:${email}`} className="text-blue-600 hover:underline">
                    {email}
                  </a>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              {isEditing ? (
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">{phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Note Details */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Note Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>State</Label>
              {isEditing ? (
                <Select value={state} onValueChange={setState} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">{state}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Note Purpose</Label>
              {isEditing ? (
                <Select value={notePurpose} onValueChange={setNotePurpose} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(NOTE_PURPOSES).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                  {NOTE_PURPOSES[notePurpose as keyof typeof NOTE_PURPOSES]?.label || notePurpose}
                  {otherNotePurpose && ` - ${otherNotePurpose}`}
                </p>
              )}
            </div>
            {isEditing && notePurpose === 'other' && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Other Purpose</Label>
                <Input
                  value={otherNotePurpose}
                  onChange={(e) => setOtherNotePurpose(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>Evaluation Date (for PDF)</Label>
              <Input
                type="date"
                value={evaluationDate}
                onChange={(e) => setEvaluationDate(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-muted-foreground text-xs">
                This date appears as &quot;Date Issued&quot; on the PDF. Not stored in database.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Diagnosis (optional)</Label>
              <Textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder=""
                rows={2}
                disabled={isLoading}
              />
              <p className="text-muted-foreground text-xs">
                Appears after &quot;due to a medical condition&quot; on the PDF. Leave blank for
                default text. Not stored in database.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                id="restrictions-toggle"
                checked={withRestrictions}
                onCheckedChange={setWithRestrictions}
                disabled={isLoading}
              />
              <Label htmlFor="restrictions-toggle" className="text-sm">
                Include &quot;with no restrictions&quot; in PDF
              </Label>
            </div>
          </div>
        </div>

        {/* Absence Dates */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Absence Dates</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First Day Off</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={firstDayOff}
                  onChange={(e) => setFirstDayOff(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">{firstDayOff}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Last Day Off</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={lastDayOff}
                  onChange={(e) => setLastDayOff(e.target.value)}
                  disabled={isLoading}
                />
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">{lastDayOff}</p>
              )}
            </div>
          </div>
        </div>

        {/* Absence Reason */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Absence Reason</h2>
          <div className="space-y-2">
            <Label>Reason</Label>
            {isEditing ? (
              <Select value={absenceReason} onValueChange={setAbsenceReason} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABSENCE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                {absenceReason}
                {otherAbsenceReason && ` - ${otherAbsenceReason}`}
              </p>
            )}
          </div>
          {isEditing && absenceReason === 'Other' && (
            <div className="space-y-2">
              <Label>Other Reason</Label>
              <Input
                value={otherAbsenceReason}
                onChange={(e) => setOtherAbsenceReason(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        {/* Symptoms */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Symptoms</h2>
          <div className="space-y-2">
            <Label>Symptoms (comma-separated)</Label>
            {isEditing ? (
              <Input
                value={symptoms.join(', ')}
                onChange={(e) =>
                  setSymptoms(
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                disabled={isLoading}
                placeholder="e.g., Fever, Cough, Headache"
              />
            ) : (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                {symptoms.length > 0 ? symptoms.join(', ') : 'None specified'}
                {otherSymptomText && ` (Other: ${otherSymptomText})`}
              </p>
            )}
          </div>
          {isEditing && symptoms.includes('Other') && (
            <div className="space-y-2">
              <Label>Other Symptom</Label>
              <Input
                value={otherSymptomText}
                onChange={(e) => setOtherSymptomText(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        {/* Additional Information */}
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Additional Information</h2>
          <div className="space-y-2">
            {isEditing ? (
              <Textarea
                value={additionalInformation}
                onChange={(e) => setAdditionalInformation(e.target.value)}
                disabled={isLoading}
                rows={4}
                placeholder="Any additional information..."
              />
            ) : (
              <p className="min-h-[60px] rounded-md bg-gray-50 px-3 py-2 text-sm whitespace-pre-wrap">
                {additionalInformation || 'None'}
              </p>
            )}
          </div>
        </div>
      </div>

      {latestNoteVerification && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Note Verification</h2>
            <Button onClick={handleCopyVerificationUrl} variant="outline" size="sm">
              Copy URL
            </Button>
          </div>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-medium text-gray-500">Medical Record #</dt>
              <dd className="mt-1 font-mono text-gray-900">
                {latestNoteVerification.medicalRecordNumber}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Verification Status</dt>
              <dd className="mt-1 text-gray-900">{latestNoteVerification.status}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Verification URL</dt>
              <dd className="mt-1 font-mono break-all text-gray-900">
                /verify/{latestNoteVerification.verificationSlug}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Submission Metadata */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Submission Details</h2>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-medium text-gray-500">Submission ID</dt>
            <dd className="mt-1 font-mono text-gray-900">{submission.id}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Payment ID</dt>
            <dd className="mt-1 font-mono text-gray-900">
              {submission.stripePaymentIntentId || 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Created</dt>
            <dd className="mt-1 text-gray-900">{formatDateTime(submission.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-gray-900">{formatDateTime(submission.updatedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Reviewed At</dt>
            <dd className="mt-1 text-gray-900">{formatDateTime(submission.reviewedAt)}</dd>
          </div>
          {submission.denialReason && (
            <div>
              <dt className="font-medium text-gray-500">Denial Reason</dt>
              <dd className="mt-1 text-gray-900">{submission.denialReason}</dd>
            </div>
          )}
          {submission.stripeRefundId && (
            <div>
              <dt className="font-medium text-gray-500">Refund ID</dt>
              <dd className="mt-1 font-mono text-gray-900">{submission.stripeRefundId}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Dialogs */}
      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approveDialogTitle}</DialogTitle>
            <DialogDescription>{approveDialogDescription}</DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <strong>Error:</strong> {error}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Processing...' : `${approveButtonText} & Send PDF`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Denial Dialog */}
      <Dialog open={showDenialDialog} onOpenChange={setShowDenialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Submission?</DialogTitle>
            <DialogDescription>
              {submission.status === SubmissionStatus.APPROVED && submission.stripeRefundId
                ? 'This submission was already refunded. No additional refund will be processed.'
                : 'This will process a full refund and send a denial notification to the patient.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <strong>Error:</strong> {error}
            </div>
          )}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Denial</Label>
              <Select value={denialReason} onValueChange={setDenialReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Legal">
                    Legal - Cannot provide note for this situation
                  </SelectItem>
                  <SelectItem value="7+ days">7+ days - Absence period exceeds 7 days</SelectItem>
                  <SelectItem value="Duplicate">Duplicate - Patient submitted twice</SelectItem>
                  <SelectItem value="Refund">Refund</SelectItem>
                  <SelectItem value="Under 18">Under 18 - Patient is a minor</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {denialReason === 'Other' && (
              <div className="space-y-2">
                <Label>Please specify</Label>
                <Input
                  value={otherDenialReason}
                  onChange={(e) => setOtherDenialReason(e.target.value)}
                  placeholder="Enter reason for denial"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDenialDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeny}
              disabled={
                isLoading || !denialReason || (denialReason === 'Other' && !otherDenialReason)
              }
              variant="destructive"
            >
              {isLoading ? 'Processing...' : 'Deny & Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maybe Dialog */}
      <MaybeReasonDialog
        open={showMaybeDialog}
        onOpenChange={setShowMaybeDialog}
        onConfirm={handleMaybe}
        isLoading={isLoading}
        error={maybeError}
        defaultReason={suggestedMaybeReason}
        canSendEmail={submission.status === SubmissionStatus.PENDING_REVIEW}
      />

      {/* Manual Dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Manual?</DialogTitle>
            <DialogDescription>
              This will move the submission to Manual handling. When approved or denied from Manual
              status, no automated emails or refunds will be processed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowManualDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleManual}
              disabled={isLoading}
              className="border-purple-500 bg-purple-50 text-purple-700 hover:bg-purple-100"
            >
              {isLoading ? 'Processing...' : 'Mark as Manual'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
