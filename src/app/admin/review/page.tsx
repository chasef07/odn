'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SubmissionCard } from '@/components/admin/SubmissionCard'
import { CompletionScreen } from '@/components/admin/CompletionScreen'
import { DenialReasonDialog } from '@/components/admin/DenialReasonDialog'
import { MaybeReasonDialog } from '@/components/admin/MaybeReasonDialog'
import { MonthlyLimitWarning } from '@/components/admin/MonthlyLimitWarning'
import { calculateDaysDifference, getTodayET, type DenialReason } from '@/lib/admin-utils'
import { DATES_EXCEED_ALLOWED_RANGE_REASON } from '@/lib/maybe-reasons'
import { ABSENCE_REASONS, NOTE_PURPOSES } from '@/lib/form-constants'
import type { Submission } from '@prisma/client'
import { getSubmissionsForReview, getMonthlyLimitData } from '@/app/admin/_actions/queues'
import { approveSubmission } from '@/app/admin/_actions/approve'
import { denySubmission } from '@/app/admin/_actions/deny'
import { maybeSubmission, type MaybeSubmissionInput } from '@/app/admin/_actions/maybe'
import { updateReviewClassification } from '@/app/admin/_actions/edits'

export default function AdminReviewPage() {
  const router = useRouter()

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [reviewedSubmissions, setReviewedSubmissions] = useState<{
    approved: string[]
    denied: string[]
    maybe: string[]
  }>({ approved: [], denied: [], maybe: [] })

  const [showCompletion, setShowCompletion] = useState(false)
  const [showDenialDialog, setShowDenialDialog] = useState(false)
  const [showMaybeDialog, setShowMaybeDialog] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [evaluationDate, setEvaluationDate] = useState(getTodayET())
  const [diagnosis, setDiagnosis] = useState('')
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [maybeError, setMaybeError] = useState<string | null>(null)
  const [reviewWarning, setReviewWarning] = useState<string | null>(null)
  const [monthlyLimitData, setMonthlyLimitData] = useState<any>(null)
  const [isLoadingMonthlyData, setIsLoadingMonthlyData] = useState(false)
  const [withRestrictions, setWithRestrictions] = useState(true)
  const [isGuardianRemovalPending, setIsGuardianRemovalPending] = useState(false)
  const [classificationDraft, setClassificationDraft] = useState<{
    notePurpose: string
    absenceReason: string
  } | null>(null)
  const [classificationError, setClassificationError] = useState<string | null>(null)
  const [isSavingClassification, setIsSavingClassification] = useState(false)

  const currentSubmission = submissions[currentIndex]
  const isLastSubmission = currentIndex === submissions.length - 1
  const isReviewBusy = isTransitioning || isGuardianRemovalPending || isSavingClassification
  const suggestedMaybeReason =
    currentSubmission &&
    calculateDaysDifference(currentSubmission.firstDayOff, currentSubmission.lastDayOff) > 7
      ? DATES_EXCEED_ALLOWED_RANGE_REASON
      : undefined
  const selectedNotePurpose =
    classificationDraft?.notePurpose ?? currentSubmission?.notePurpose ?? ''
  const selectedAbsenceReason =
    classificationDraft?.absenceReason ?? currentSubmission?.absenceReason ?? ''
  const hasClassificationChanges =
    !!currentSubmission &&
    (selectedNotePurpose !== currentSubmission.notePurpose ||
      selectedAbsenceReason !== currentSubmission.absenceReason)
  const isReviewActionDisabled = isReviewBusy || hasClassificationChanges

  const handleGuardianRemoved = () => {
    if (!currentSubmission) return

    setSubmissions((prev) =>
      prev.map((submission) =>
        submission.id === currentSubmission.id
          ? {
              ...submission,
              recipient: 'myself',
              guardianFirstName: null,
              guardianLastName: null,
              guardianDateOfBirth: null,
            }
          : submission
      )
    )
  }

  useEffect(() => {
    async function fetchSubmissions() {
      setIsLoading(true)
      setError(null)

      const result = await getSubmissionsForReview()

      if (result.success && result.data) {
        setSubmissions(result.data)
      } else {
        setError(result.error || 'Failed to load submissions')
      }

      setIsLoading(false)
    }

    fetchSubmissions()
  }, [])

  useEffect(() => {
    async function fetchMonthlyData() {
      if (!currentSubmission) {
        setMonthlyLimitData(null)
        return
      }

      setIsLoadingMonthlyData(true)

      const result = await getMonthlyLimitData(
        currentSubmission.patientFirstName,
        currentSubmission.patientLastName,
        new Date(currentSubmission.patientDateOfBirth),
        new Date(currentSubmission.firstDayOff),
        new Date(currentSubmission.lastDayOff)
      )

      if (result.success && result.data) {
        setMonthlyLimitData(result.data)
      }

      setIsLoadingMonthlyData(false)
    }

    fetchMonthlyData()
  }, [currentSubmission])

  useEffect(() => {
    if (!currentSubmission) {
      setClassificationDraft(null)
      setClassificationError(null)
      return
    }

    setClassificationDraft({
      notePurpose: currentSubmission.notePurpose,
      absenceReason: currentSubmission.absenceReason,
    })
    setClassificationError(null)
  }, [currentSubmission])

  const handleClassificationSave = async () => {
    if (!currentSubmission || !classificationDraft || isReviewBusy) return

    setIsSavingClassification(true)
    setClassificationError(null)

    const result = await updateReviewClassification(currentSubmission.id, {
      notePurpose: classificationDraft.notePurpose,
      otherNotePurpose:
        classificationDraft.notePurpose === 'other' ? currentSubmission.otherNotePurpose : null,
      absenceReason: classificationDraft.absenceReason,
      otherAbsenceReason:
        classificationDraft.absenceReason === 'Other' ? currentSubmission.otherAbsenceReason : null,
    })

    if (result.success) {
      setSubmissions((prev) =>
        prev.map((submission) =>
          submission.id === currentSubmission.id
            ? {
                ...submission,
                notePurpose: classificationDraft.notePurpose,
                otherNotePurpose:
                  classificationDraft.notePurpose === 'other' ? submission.otherNotePurpose : null,
                absenceReason: classificationDraft.absenceReason,
                otherAbsenceReason:
                  classificationDraft.absenceReason === 'Other'
                    ? submission.otherAbsenceReason
                    : null,
              }
            : submission
        )
      )
    } else {
      setClassificationError(result.error || 'Failed to save classification')
    }

    setIsSavingClassification(false)
  }

  const handleApprove = () => {
    if (!currentSubmission || isReviewActionDisabled) return
    setApprovalError(null)
    setReviewWarning(null)
    setShowApprovalDialog(true)
  }

  const handleApproveConfirm = async () => {
    if (!currentSubmission || isReviewActionDisabled) return

    setIsTransitioning(true)
    setApprovalError(null)

    const result = await approveSubmission(
      currentSubmission.id,
      evaluationDate,
      diagnosis || undefined,
      withRestrictions
    )

    if (result.success) {
      setShowApprovalDialog(false)
      setDiagnosis('')
      setReviewWarning(result.warning ?? null)

      setReviewedSubmissions((prev) => ({
        ...prev,
        approved: [...prev.approved, currentSubmission.id],
      }))

      setTimeout(() => {
        setEvaluationDate(getTodayET())

        if (isLastSubmission) {
          setShowCompletion(true)
        } else {
          setCurrentIndex((prev) => prev + 1)
          setWithRestrictions(true)
        }
        setIsTransitioning(false)
      }, 150)
    } else {
      setIsTransitioning(false)
      setReviewWarning(null)
      setApprovalError(result.error || 'Failed to approve submission')
    }
  }

  const handleDeny = () => {
    if (!currentSubmission || isReviewActionDisabled) return
    setReviewWarning(null)
    setShowDenialDialog(true)
  }

  const handleDenyConfirm = async (reason: DenialReason) => {
    if (!currentSubmission || isReviewActionDisabled) return

    setIsTransitioning(true)

    const result = await denySubmission(currentSubmission.id, reason)

    if (result.success) {
      setReviewWarning(result.warning ?? null)

      setReviewedSubmissions((prev) => ({
        ...prev,
        denied: [...prev.denied, currentSubmission.id],
      }))

      setTimeout(() => {
        if (isLastSubmission) {
          setShowCompletion(true)
        } else {
          setCurrentIndex((prev) => prev + 1)
          setWithRestrictions(true)
        }
        setIsTransitioning(false)
      }, 150)
    } else {
      setIsTransitioning(false)
      setReviewWarning(null)
      setError(result.error || 'Failed to deny submission')
    }
  }

  const handleMaybe = () => {
    if (!currentSubmission || isReviewActionDisabled) return

    setMaybeError(null)
    setReviewWarning(null)
    setShowMaybeDialog(true)
  }

  const handleMaybeConfirm = async (input: MaybeSubmissionInput) => {
    if (!currentSubmission || isReviewActionDisabled) return

    setIsTransitioning(true)
    setMaybeError(null)

    const result = await maybeSubmission(currentSubmission.id, input)

    if (result.success) {
      setShowMaybeDialog(false)
      setReviewWarning(result.warning ?? null)

      setReviewedSubmissions((prev) => ({
        ...prev,
        maybe: [...prev.maybe, currentSubmission.id],
      }))

      setTimeout(() => {
        if (isLastSubmission) {
          setShowCompletion(true)
        } else {
          setCurrentIndex((prev) => prev + 1)
          setWithRestrictions(true)
        }
        setIsTransitioning(false)
      }, 150)
    } else {
      setIsTransitioning(false)
      setReviewWarning(null)
      setMaybeError(result.error || 'Failed to mark submission as maybe')
    }
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        isTransitioning ||
        isGuardianRemovalPending ||
        isSavingClassification ||
        showCompletion ||
        showDenialDialog ||
        showMaybeDialog ||
        showApprovalDialog
      ) {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleDeny()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleApprove()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        handleMaybe()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentIndex,
    isTransitioning,
    isGuardianRemovalPending,
    isSavingClassification,
    hasClassificationChanges,
    showCompletion,
    showDenialDialog,
    showMaybeDialog,
    showApprovalDialog,
    currentSubmission,
  ])

  const handleReturnToDashboard = () => {
    router.push('/admin')
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading submissions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <p className="font-semibold text-red-600">Error loading submissions</p>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold">No Pending Submissions</h2>
          <p className="text-muted-foreground">All submissions have been reviewed!</p>
          <Button onClick={handleReturnToDashboard}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  if (showCompletion) {
    return (
      <CompletionScreen
        approvedCount={reviewedSubmissions.approved.length}
        deniedCount={reviewedSubmissions.denied.length}
        maybeCount={reviewedSubmissions.maybe.length}
        warning={reviewWarning}
        onReturnToDashboard={handleReturnToDashboard}
      />
    )
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col space-y-3">
      <div className="flex shrink-0 items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/admin')} size="sm">
          ← Back
        </Button>
        <Link href="/admin/search">
          <Button variant="outline" size="sm" className="gap-1">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </Link>
      </div>

      {reviewWarning && (
        <div
          role="alert"
          className="mx-auto w-full max-w-2xl rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900"
        >
          <strong>Warning:</strong> {reviewWarning}
        </div>
      )}

      <div
        className={`flex-1 overflow-auto transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="space-y-4">
          {!isLoadingMonthlyData && monthlyLimitData && (
            <MonthlyLimitWarning
              monthlyUsage={monthlyLimitData.currentUsage}
              requestedDays={monthlyLimitData.requestedDays}
              newTotal={monthlyLimitData.newTotal}
            />
          )}

          <SubmissionCard
            submission={currentSubmission}
            currentIndex={currentIndex}
            totalCount={submissions.length}
            evaluationDate={evaluationDate}
            onEvaluationDateChange={setEvaluationDate}
            diagnosis={diagnosis}
            onDiagnosisChange={setDiagnosis}
            withRestrictions={withRestrictions}
            onWithRestrictionsChange={setWithRestrictions}
            onGuardianRemovalPendingChange={setIsGuardianRemovalPending}
            onGuardianRemoved={handleGuardianRemoved}
            notePurposeOptions={Object.entries(NOTE_PURPOSES).map(([value, { label }]) => ({
              value,
              label,
            }))}
            absenceReasonOptions={[...ABSENCE_REASONS]}
            selectedNotePurpose={selectedNotePurpose}
            selectedAbsenceReason={selectedAbsenceReason}
            onNotePurposeChange={(notePurpose) =>
              setClassificationDraft((prev) => ({
                notePurpose,
                absenceReason: prev?.absenceReason ?? currentSubmission.absenceReason,
              }))
            }
            onAbsenceReasonChange={(absenceReason) =>
              setClassificationDraft((prev) => ({
                notePurpose: prev?.notePurpose ?? currentSubmission.notePurpose,
                absenceReason,
              }))
            }
            onClassificationSave={handleClassificationSave}
            classificationError={classificationError}
            isClassificationDirty={hasClassificationChanges}
            isClassificationSaving={isSavingClassification}
            isClassificationDisabled={isReviewBusy}
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl shrink-0 pb-2">
        <div className="flex items-center justify-center gap-8 sm:gap-12">
          <button
            onClick={handleDeny}
            disabled={isReviewActionDisabled}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-200 bg-white shadow-lg transition-all hover:scale-110 hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-red-500"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <button
            onClick={handleMaybe}
            disabled={isReviewActionDisabled}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-200 bg-white shadow-lg transition-all hover:scale-110 hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            <span className="text-4xl font-bold text-yellow-500">?</span>
          </button>

          <button
            onClick={handleApprove}
            disabled={isReviewActionDisabled}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-200 bg-white shadow-lg transition-all hover:scale-110 hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-green-500"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </div>

      <DenialReasonDialog
        open={showDenialDialog}
        onOpenChange={setShowDenialDialog}
        onConfirm={handleDenyConfirm}
      />

      <MaybeReasonDialog
        open={showMaybeDialog}
        onOpenChange={setShowMaybeDialog}
        onConfirm={handleMaybeConfirm}
        isLoading={isTransitioning}
        error={maybeError}
        defaultReason={suggestedMaybeReason}
      />

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Submission?</DialogTitle>
            <DialogDescription>
              This will generate a doctor&apos;s note PDF and send it to the patient via email.
            </DialogDescription>
          </DialogHeader>

          {approvalError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <strong>Error:</strong> {approvalError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={isReviewActionDisabled}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveConfirm}
              disabled={isReviewActionDisabled}
              className="bg-green-600 hover:bg-green-700"
            >
              {isTransitioning ? 'Approving...' : 'Approve & Send PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
