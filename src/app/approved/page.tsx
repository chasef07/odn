"use client";

import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ApprovedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Top-Right Logo */}
      <div className="fixed top-6 right-6 z-10">
        <div className="rounded-full bg-white/80 backdrop-blur-sm border border-primary/10 px-4 py-2 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
            onlinedoctornote
          </span>
        </div>
      </div>

      {/* Main Content - Centered */}
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">

        {/* Congratulations Heading */}
        <h1 className="text-5xl sm:text-6xl font-display font-bold text-foreground mb-12">
          Congratulations!
        </h1>

        {/* Approval Checklist */}
        <div className="space-y-5 mb-12 text-left max-w-xl mx-auto">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground font-medium">
              You&apos;ve been approved
            </p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground">
              The doctor will review your chart and contact you if needed
            </p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground">
              Your note will be emailed to you
            </p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground">
              We&apos;ll verify the note if necessary
            </p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground font-medium">
              100% money-back guarantee
            </p>
          </div>
        </div>

        {/* Pricing Callout */}
        <p className="text-xl text-muted-foreground mb-12">
          Final step - just $24.95 for your official doctor&apos;s note.
        </p>

        {/* Navigation Buttons */}
        <div className="pt-2 flex justify-between items-center max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => router.push('/review')}
            className="inline-flex items-center justify-center rounded-lg p-2 text-foreground transition-all hover:bg-accent"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => router.push('/payment')}
            className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold transition-all shadow-sm bg-primary text-white hover:bg-primary/90"
          >
            Continue
          </button>
        </div>
      </main>
    </div>
  );
}
