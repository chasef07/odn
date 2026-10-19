'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { parseDateOnly, todayET, utcDateFromDateOnly } from '@/lib/dates'
import { RemoveGuardianModeControl } from '@/components/admin/RemoveGuardianModeControl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AVAILABLE_STATES, ABSENCE_REASONS, NOTE_PURPOSES } from '@/lib/form-constants'
import { updateSubmission } from '@/app/admin/_actions/edits'
import { approveSubmission } from '@/app/admin/_actions/approve'
import { type FormattedSubmission } from '@/app/admin/_actions/search'
import { DATE_LIMITS } from '@/lib/validation-constants'

interface SubmissionEditFormProps {
  submission: FormattedSubmission
}

function dayInput(value: string): Date | null {
  const day = parseDateOnly(value)
  return day && day >= DATE_LIMITS.EARLIEST_DAY ? utcDateFromDateOnly(day) : null
}

export function SubmissionEditForm({ submission }: SubmissionEditFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isGuardianRemovalPending, setIsGuardianRemovalPending] = useState(false)
  const isActionDisabled = isLoading || isGuardianRemovalPending
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
  const [recipient, setRecipient] = useState(submission.recipient)
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

  const [evaluationDate, setEvaluationDate] = useState<string>(todayET())
  const [diagnosis, setDiagnosis] = useState('')
  const [withRestrictions, setWithRestrictions] = useState(true)

  const handleGuardianRemoved = () => {
    setRecipient('myself')
    setGuardianFirstName('')
    setGuardianLastName('')
    setGuardianDateOfBirth('')
  }

  const handleApprove = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await approveSubmission(
        submission.id,
        evaluationDate,
        diagnosis || undefined,
        withRestrictions
      )

      if (result.success) {
        setSuccess('Submission approved! PDF sent to patient.')
        setDiagnosis('')
        setTimeout(() => {
          router.push('/admin/maybe')
        }, 1000)
      } else {
        setError(result.error || 'Failed to approve submission')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const savedDateOfBirth = dayInput(patientDateOfBirth)
    const savedGuardianDateOfBirth = guardianDateOfBirth ? dayInput(guardianDateOfBirth) : null
    const savedFirstDayOff = dayInput(firstDayOff)
    const savedLastDayOff = dayInput(lastDayOff)
    if (
      !savedDateOfBirth ||
      !savedFirstDayOff ||
      !savedLastDayOff ||
      (guardianDateOfBirth && !savedGuardianDateOfBirth)
    ) {
      setError('Enter every date as a real calendar day, 1900 or later.')
      setIsLoading(false)
      return
    }

    try {
      const result = await updateSubmission(submission.id, {
        patientFirstName,
        patientLastName,
        patientDateOfBirth: savedDateOfBirth,
        guardianFirstName: guardianFirstName || null,
        guardianLastName: guardianLastName || null,
        guardianDateOfBirth: savedGuardianDateOfBirth,
        email,
        phone,
        state,
        notePurpose,
        otherNotePurpose: otherNotePurpose || null,
        firstDayOff: savedFirstDayOff,
        lastDayOff: savedLastDayOff,
        absenceReason,
        otherAbsenceReason: otherAbsenceReason || null,
        symptoms,
        otherSymptomText: otherSymptomText || null,
        additionalInformation: additionalInformation || null,
      })

      if (result.success) {
        setSuccess('Changes saved successfully!')
        setTimeout(() => {
          router.push('/admin/maybe')
        }, 1000)
      } else {
        setError(result.error || 'Failed to save changes')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary rounded px-2 py-1 text-sm font-medium">
                Admin Portal
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-3xl font-bold">Edit Submission</h1>
              <p className="text-muted-foreground mt-1 text-sm">ID: {submission.id}</p>
            </div>
            <Link href="/admin/maybe">
              <Button variant="outline">Back to List</Button>
            </Link>
          </div>

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

          <div className="space-y-8 rounded-lg border border-gray-200 bg-white p-6 shadow">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Patient Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="patientFirstName">First Name</Label>
                  <Input
                    id="patientFirstName"
                    value={patientFirstName}
                    onChange={(e) => setPatientFirstName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patientLastName">Last Name</Label>
                  <Input
                    id="patientLastName"
                    value={patientLastName}
                    onChange={(e) => setPatientLastName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="patientDateOfBirth">Date of Birth</Label>
                  <Input
                    id="patientDateOfBirth"
                    type="date"
                    min={DATE_LIMITS.EARLIEST_DAY}
                    value={patientDateOfBirth}
                    onChange={(e) => setPatientDateOfBirth(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <RemoveGuardianModeControl
              submissionId={submission.id}
              patientDateOfBirth={submission.patientDateOfBirth}
              recipient={recipient}
              guardianFirstName={guardianFirstName}
              guardianLastName={guardianLastName}
              guardianDateOfBirth={guardianDateOfBirth || null}
              disabled={isLoading}
              onPendingChange={setIsGuardianRemovalPending}
              onRemoved={handleGuardianRemoved}
            />

            {(guardianFirstName || guardianLastName || recipient === 'someone_else') && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Guardian Information</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="guardianFirstName">First Name</Label>
                    <Input
                      id="guardianFirstName"
                      value={guardianFirstName}
                      onChange={(e) => setGuardianFirstName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianLastName">Last Name</Label>
                    <Input
                      id="guardianLastName"
                      value={guardianLastName}
                      onChange={(e) => setGuardianLastName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianDateOfBirth">Date of Birth</Label>
                    <Input
                      id="guardianDateOfBirth"
                      type="date"
                      min={DATE_LIMITS.EARLIEST_DAY}
                      value={guardianDateOfBirth}
                      onChange={(e) => setGuardianDateOfBirth(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Note Details</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select value={state} onValueChange={setState} disabled={isLoading}>
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notePurpose">Note Purpose</Label>
                  <Select value={notePurpose} onValueChange={setNotePurpose} disabled={isLoading}>
                    <SelectTrigger id="notePurpose">
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NOTE_PURPOSES).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {notePurpose === 'other' && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="otherNotePurpose">Other Purpose</Label>
                    <Input
                      id="otherNotePurpose"
                      value={otherNotePurpose}
                      onChange={(e) => setOtherNotePurpose(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">PDF Options</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="evaluationDate">Evaluation Date</Label>
                  <Input
                    id="evaluationDate"
                    type="date"
                    min={DATE_LIMITS.EARLIEST_DAY}
                    value={evaluationDate}
                    onChange={(e) => setEvaluationDate(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-muted-foreground text-xs">
                    Appears as &quot;Date Issued&quot; on the PDF.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Diagnosis (optional)</Label>
                  <Textarea
                    id="diagnosis"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder=""
                    rows={2}
                    disabled={isLoading}
                  />
                  <p className="text-muted-foreground text-xs">
                    Appears after the medical condition text. Leave blank for default.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="withRestrictions"
                  checked={withRestrictions}
                  onCheckedChange={setWithRestrictions}
                  disabled={isLoading}
                />
                <Label htmlFor="withRestrictions" className="text-sm">
                  Include &quot;with no restrictions&quot; in PDF
                </Label>
              </div>
              <p className="text-muted-foreground text-xs">
                These options are not stored in the database - they only affect the generated PDF.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Absence Dates</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstDayOff">First Day Off</Label>
                  <Input
                    id="firstDayOff"
                    type="date"
                    min={DATE_LIMITS.EARLIEST_DAY}
                    value={firstDayOff}
                    onChange={(e) => setFirstDayOff(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastDayOff">Last Day Off</Label>
                  <Input
                    id="lastDayOff"
                    type="date"
                    min={DATE_LIMITS.EARLIEST_DAY}
                    value={lastDayOff}
                    onChange={(e) => setLastDayOff(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Absence Reason</h2>
              <div className="space-y-2">
                <Label htmlFor="absenceReason">Reason</Label>
                <Select value={absenceReason} onValueChange={setAbsenceReason} disabled={isLoading}>
                  <SelectTrigger id="absenceReason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {ABSENCE_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {absenceReason === 'Other' && (
                  <div className="mt-2 space-y-2">
                    <Label htmlFor="otherAbsenceReason">Other Reason</Label>
                    <Input
                      id="otherAbsenceReason"
                      value={otherAbsenceReason}
                      onChange={(e) => setOtherAbsenceReason(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Symptoms</h2>
              <div className="space-y-2">
                <Label htmlFor="symptoms">Symptoms (comma-separated)</Label>
                <Input
                  id="symptoms"
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
              </div>
              {symptoms.includes('Other') && (
                <div className="space-y-2">
                  <Label htmlFor="otherSymptomText">Other Symptom</Label>
                  <Input
                    id="otherSymptomText"
                    value={otherSymptomText}
                    onChange={(e) => setOtherSymptomText(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Additional Information</h2>
              <div className="space-y-2">
                <Label htmlFor="additionalInformation">Additional Information</Label>
                <Textarea
                  id="additionalInformation"
                  value={additionalInformation}
                  onChange={(e) => setAdditionalInformation(e.target.value)}
                  disabled={isLoading}
                  rows={4}
                  placeholder="Any additional information..."
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-200 pt-6">
              <Button onClick={handleSave} disabled={isActionDisabled} size="lg">
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isActionDisabled}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Approving...' : 'Approve & Send PDF'}
              </Button>
              <Link href="/admin/maybe">
                <Button variant="outline" disabled={isActionDisabled} size="lg">
                  Back to Maybe List
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
