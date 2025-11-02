'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowLeft } from 'lucide-react'

export default function ApprovedPage() {
  const router = useRouter()

  return (
    <div className="text-foreground min-h-screen bg-white">
      {/* Main Content - Centered */}
      <main className="mx-auto max-w-4xl px-6 py-12 text-center">
        {/* Congratulations Heading */}
        <h1 className="font-display text-foreground mb-10 text-4xl font-bold sm:text-5xl">
          Congratulations!
        </h1>

        {/* Approval Checklist */}
        <div className="mx-auto mb-10 max-w-xl space-y-5 text-left">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
            <p className="text-foreground text-lg">You&apos;ve been approved</p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
            <p className="text-foreground text-lg">
              The doctor will review your chart and contact you if needed
            </p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
            <p className="text-foreground text-lg">Your note will be emailed to you</p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
            <p className="text-foreground text-lg">We&apos;ll verify the note if necessary</p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
            <p className="text-foreground text-lg">100% money-back guarantee</p>
          </div>
        </div>

        {/* Pricing Callout */}
        <p className="text-muted-foreground mb-8 text-xl">
          Final step - just $24.95 for your official doctor&apos;s note.
        </p>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/review')}
            className="text-foreground hover:bg-accent inline-flex items-center justify-center rounded-lg p-2 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => router.push('/payment')}
            className="bg-primary hover:bg-primary/90 inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white shadow-sm transition-all"
          >
            Continue
          </button>
        </div>
      </main>
    </div>
  )
}
