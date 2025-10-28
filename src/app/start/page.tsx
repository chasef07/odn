"use client";

import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Simple top-right logo */}
      <div className="fixed top-6 right-6 z-10">
        <div className="rounded-full bg-white/80 backdrop-blur-sm border border-primary/10 px-4 py-2 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
            onlinedoctornote
          </span>
        </div>
      </div>

      {/* Main Content - Centered */}
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">

        {/* Headlines */}
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-4">
          Need a quick doctor&apos;s note for work or school?
        </h1>

        <p className="text-2xl text-muted-foreground mb-12">
          You&apos;re in the right place.
        </p>

        {/* Value Props with Checkmarks */}
        <div className="space-y-4 mb-12 text-left max-w-xl mx-auto">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground">
              <span className="font-semibold">Easy</span> - 100% online
            </p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground">
              <span className="font-semibold">Affordable</span> - only $24.95
            </p>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground">
              <span className="font-semibold">Valid</span> - signed by a board-certified physician licensed in your state
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => router.push('/get-started')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-12 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all"
        >
          Request My Note
          <ArrowRight className="h-5 w-5" />
        </button>

        {/* Disclaimer */}
        <div className="mt-16 max-w-xl mx-auto">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium">Please note:</span> This service is not meant to be used for legal issues, FMLA, workman&apos;s compensation, or disability and insurance claims. You must be 18+ or a parent / guardian requesting for a minor.
          </p>
        </div>
      </main>
    </div>
  );
}
