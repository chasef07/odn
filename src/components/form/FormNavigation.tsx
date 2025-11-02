'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface FormNavigationProps {
  /** Route to navigate to when clicking back button */
  backRoute: string

  /** Text for the submit/continue button (default: "Continue") */
  submitText?: string

  /** Whether the form is currently submitting */
  isSubmitting?: boolean

  /** Override back button click handler (optional) */
  onBackClick?: () => void
}

export function FormNavigation({
  backRoute,
  submitText = 'Continue',
  isSubmitting = false,
  onBackClick,
}: FormNavigationProps) {
  const router = useRouter()

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick()
    } else {
      router.push(backRoute)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={handleBackClick}
        className="text-foreground hover:bg-accent inline-flex items-center justify-center rounded-lg p-2 transition-all"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary hover:bg-primary/90 inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Loading...' : submitText}
      </button>
    </div>
  )
}
