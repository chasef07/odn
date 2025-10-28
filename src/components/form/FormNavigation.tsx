"use client";

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface FormNavigationProps {
  /** Route to navigate to when clicking back button */
  backRoute: string;

  /** Text for the submit/continue button (default: "Continue") */
  submitText?: string;

  /** Whether the form is currently submitting */
  isSubmitting?: boolean;

  /** Override back button click handler (optional) */
  onBackClick?: () => void;
}

export function FormNavigation({
  backRoute,
  submitText = 'Continue',
  isSubmitting = false,
  onBackClick,
}: FormNavigationProps) {
  const router = useRouter();

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      router.push(backRoute);
    }
  };

  return (
    <div className="flex justify-between items-center">
      <button
        type="button"
        onClick={handleBackClick}
        className="inline-flex items-center justify-center rounded-lg p-2 text-foreground transition-all hover:bg-accent"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold transition-all shadow-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Loading...' : submitText}
      </button>
    </div>
  );
}
