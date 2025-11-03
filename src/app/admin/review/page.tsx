'use client'

/**
 * Admin Review Interface Page
 * Tinder-like interface for reviewing submissions with keyboard shortcuts
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SubmissionCard } from '@/components/admin/SubmissionCard'
import { CompletionScreen } from '@/components/admin/CompletionScreen'
import { mockSubmissions } from '@/lib/mock-submissions'

export default function AdminReviewPage() {
  const router = useRouter()

  // State management
  const [submissions] = useState(() => {
    // Sort by oldest first (FIFO queue)
    return [...mockSubmissions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  })

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [reviewedSubmissions, setReviewedSubmissions] = useState<{
    approved: string[]
    denied: string[]
  }>({ approved: [], denied: [] })

  const [showCompletion, setShowCompletion] = useState(false)

  const currentSubmission = submissions[currentIndex]
  const isLastSubmission = currentIndex === submissions.length - 1

  // Handle approval
  const handleApprove = () => {
    if (!currentSubmission || isTransitioning) return

    setIsTransitioning(true)

    // Add to approved list
    setReviewedSubmissions((prev) => ({
      ...prev,
      approved: [...prev.approved, currentSubmission.id],
    }))

    // Quick fade transition
    setTimeout(() => {
      if (isLastSubmission) {
        // Show completion screen
        setShowCompletion(true)
      } else {
        // Move to next submission
        setCurrentIndex((prev) => prev + 1)
      }
      setIsTransitioning(false)
    }, 150)
  }

  // Handle denial
  const handleDeny = () => {
    if (!currentSubmission || isTransitioning) return

    setIsTransitioning(true)

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
      }
      setIsTransitioning(false)
    }, 150)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent if transitioning or on completion screen
      if (isTransitioning || showCompletion) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault() // Prevent scroll
        handleDeny()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault() // Prevent scroll
        handleApprove()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isTransitioning, showCompletion, currentSubmission])

  // Handle return to dashboard
  const handleReturnToDashboard = () => {
    router.push('/admin')
  }

  // If no submissions, redirect to dashboard
  if (submissions.length === 0) {
    router.push('/admin')
    return null
  }

  // Show completion screen
  if (showCompletion) {
    return (
      <CompletionScreen
        approvedCount={reviewedSubmissions.approved.length}
        deniedCount={reviewedSubmissions.denied.length}
        onReturnToDashboard={handleReturnToDashboard}
      />
    )
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col space-y-3">
      {/* Back Button */}
      <div className="flex shrink-0 items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/admin')} size="sm">
          ← Back
        </Button>
      </div>

      {/* Submission Card with fade transition - scrollable on mobile */}
      <div
        className={`flex-1 overflow-auto transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        <SubmissionCard
          submission={currentSubmission}
          currentIndex={currentIndex}
          totalCount={submissions.length}
        />
      </div>

      {/* Action Buttons - Tinder-style - always visible */}
      <div className="mx-auto w-full max-w-2xl shrink-0 pb-2">
        <div className="flex items-center justify-center gap-20 sm:gap-24">
          {/* Deny Button */}
          <button
            onClick={handleDeny}
            disabled={isTransitioning}
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

          {/* Approve Button */}
          <button
            onClick={handleApprove}
            disabled={isTransitioning}
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
    </div>
  )
}
