'use client'

/**
 * Admin Review Interface Page
 * Tinder-like interface for reviewing submissions with keyboard shortcuts
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
import { getTodayLocal } from '@/components/admin/ApprovalDialogContent'
import { calculateDaysDifference, type DenialReason } from '@/lib/admin-utils'
import { DATES_EXCEED_ALLOWED_RANGE_REASON } from '@/lib/maybe-reasons'
import type { Submission } from '@prisma/client'
import {
  getSubmissionsForReview,
  approveSubmission,
  denySubmission,
  maybeSubmission,
  getMonthlyLimitData,
  type MaybeSubmissionInput,
} from '../actions'

export default function AdminReviewPage() {
  const router = useRouter()

  // State management
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
  const [evaluationDate, setEvaluationDate] = useState(getTodayLocal())
  const [diagnosis, setDiagnosis] = useState('')
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [maybeError, setMaybeError] = useState<string | null>(null)
  const [reviewWarning, setReviewWarning] = useState<string | null>(null)
  const [monthlyLimitData, setMonthlyLimitData] = useState<any>(null)
  const [isLoadingMonthlyData, setIsLoadingMonthlyData] = useState(false)
  const [withRestrictions, setWithRestrictions] = useState(true)
  const [isGuardianRemovalPending, setIsGuardianRemovalPending] = useState(false)

  const currentSubmission = submissions[currentIndex]
  const isLastSubmission = currentIndex === submissions.length - 1
  const isReviewActionDisabled = isTransitioning || isGuardianRemovalPending
  const suggestedMaybeReason =
    currentSubmission &&
    calculateDaysDifference(currentSubmission.firstDayOff, currentSubmission.lastDayOff) > 7
      ? DATES_EXCEED_ALLOWED_RANGE_REASON
      : undefined

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

  // Fetch submissions on mount
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

  // Fetch monthly limit data when submission changes
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

  // Handle approval - show dialog first
  const handleApprove = () => {
    if (!currentSubmission || isReviewActionDisabled) return
    setApprovalError(null)
    setReviewWarning(null)
    setShowApprovalDialog(true)
  }

  // Handle approval confirmation with evaluation date and diagnosis
  const handleApproveConfirm = async () => {
    if (!currentSubmission || isReviewActionDisabled) return

    setIsTransitioning(true)
    setApprovalError(null)

    // Call server action to approve with evaluation date, diagnosis, and restrictions toggle
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

      // Add to approved list
      setReviewedSubmissions((prev) => ({
        ...prev,
        approved: [...prev.approved, currentSubmission.id],
      }))

      // Quick fade transition
      setTimeout(() => {
        // Reset evaluation date to today for next submission
        setEvaluationDate(getTodayLocal())

        if (isLastSubmission) {
          // Show completion screen
          setShowCompletion(true)
        } else {
          // Move to next submission
          setCurrentIndex((prev) => prev + 1)
          setWithRestrictions(true) // Reset to default for next submission
        }
        setIsTransitioning(false)
      }, 150)
    } else {
      setIsTransitioning(false)
      setReviewWarning(null)
      setApprovalError(result.error || 'Failed to approve submission')
    }
  }

  // Handle denial - show dialog first
  const handleDeny = () => {
    if (!currentSubmission || isReviewActionDisabled) return
    setReviewWarning(null)
    setShowDenialDialog(true)
  }

  // Handle denial confirmation with reason
  const handleDenyConfirm = async (reason: DenialReason) => {
    if (!currentSubmission || isReviewActionDisabled) return

    setIsTransitioning(true)

    // Call server action to deny with reason
    const result = await denySubmission(currentSubmission.id, reason)

    if (result.success) {
      setReviewWarning(result.warning ?? null)

      // Add to denied list
      setReviewedSubmissions((prev) => ({
        ...prev,
        denied: [...prev.denied, currentSubmission.id],
      }))

      // Quick fade transition
      setTimeout(() => {
        if (isLastSubmission) {
          // Show completion screen
          setShowCompletion(true)
        } else {
          // Move to next submission
          setCurrentIndex((prev) => prev + 1)
          setWithRestrictions(true) // Reset to default for next submission
        }
        setIsTransitioning(false)
      }, 150)
    } else {
      setIsTransitioning(false)
      setReviewWarning(null)
      setError(result.error || 'Failed to deny submission')
    }
  }

  // Handle maybe - show dialog first
  const handleMaybe = () => {
    if (!currentSubmission || isReviewActionDisabled) return

    setMaybeError(null)
    setReviewWarning(null)
    setShowMaybeDialog(true)
  }

  // Handle maybe confirmation with reason
  const handleMaybeConfirm = async (input: MaybeSubmissionInput) => {
    if (!currentSubmission || isReviewActionDisabled) return

    setIsTransitioning(true)
    setMaybeError(null)

    // Call server action to mark as maybe
    const result = await maybeSubmission(currentSubmission.id, input)

    if (result.success) {
      setShowMaybeDialog(false)
      setReviewWarning(result.warning ?? null)

      // Add to maybe list
      setReviewedSubmissions((prev) => ({
        ...prev,
        maybe: [...prev.maybe, currentSubmission.id],
      }))

      // Quick fade transition
      setTimeout(() => {
        if (isLastSubmission) {
          // Show completion screen
          setShowCompletion(true)
        } else {
          // Move to next submission
          setCurrentIndex((prev) => prev + 1)
          setWithRestrictions(true) // Reset to default for next submission
        }
        setIsTransitioning(false)
      }, 150)
    } else {
      setIsTransitioning(false)
      setReviewWarning(null)
      setMaybeError(result.error || 'Failed to mark submission as maybe')
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent if transitioning, on completion screen, or dialog is open
      if (
        isTransitioning ||
        isGuardianRemovalPending ||
        showCompletion ||
        showDenialDialog ||
        showMaybeDialog ||
        showApprovalDialog
      ) {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault() // Prevent scroll
        handleDeny()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault() // Prevent scroll
        handleApprove()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault() // Prevent scroll
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
    showCompletion,
    showDenialDialog,
    showMaybeDialog,
    showApprovalDialog,
    currentSubmission,
  ])

  // Handle return to dashboard
  const handleReturnToDashboard = () => {
    router.push('/admin')
  }

  // Loading state
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

  // Error state
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

  // If no submissions, show empty state
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

  // Show completion screen
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
      {/* Back Button & Search */}
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

      {/* Submission Card with fade transition - scrollable on mobile */}
      <div
        className={`flex-1 overflow-auto transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="space-y-4">
          {/* 30-Day Limit Warning (shows when approaching or exceeding) */}
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
          />
        </div>
      </div>

      {/* Action Buttons - Tinder-style - always visible */}
      <div className="mx-auto w-full max-w-2xl shrink-0 pb-2">
        <div className="flex items-center justify-center gap-8 sm:gap-12">
          {/* Deny Button */}
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

          {/* Maybe Button */}
          <button
            onClick={handleMaybe}
            disabled={isReviewActionDisabled}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-200 bg-white shadow-lg transition-all hover:scale-110 hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            <span className="text-4xl font-bold text-yellow-500">?</span>
          </button>

          {/* Approve Button */}
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

      {/* Denial Reason Dialog */}
      <DenialReasonDialog
        open={showDenialDialog}
        onOpenChange={setShowDenialDialog}
        onConfirm={handleDenyConfirm}
      />

      {/* Maybe Reason Dialog */}
      <MaybeReasonDialog
        open={showMaybeDialog}
        onOpenChange={setShowMaybeDialog}
        onConfirm={handleMaybeConfirm}
        isLoading={isTransitioning}
        error={maybeError}
        defaultReason={suggestedMaybeReason}
      />

      {/* Approval Dialog */}
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
