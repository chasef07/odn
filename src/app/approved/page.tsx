"use client";

import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { FormNavigation } from '@/components/form/FormNavigation';

export default function ApprovedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Main Content - Centered */}
      <main className="mx-auto max-w-4xl px-6 py-12 text-center">

        {/* Congratulations Heading */}
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-10">
          Congratulations!
        </h1>

        {/* Approval Checklist */}
        <div className="space-y-5 mb-10 text-left max-w-xl mx-auto">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
            <p className="text-lg text-foreground">
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
            <p className="text-lg text-foreground">
              100% money-back guarantee
            </p>
          </div>
        </div>

        {/* Pricing Callout */}
        <p className="text-xl text-muted-foreground mb-8">
          Final step - just $24.95 for your official doctor&apos;s note.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); router.push('/payment'); }}>
          <FormNavigation
            backRoute="/review"
            submitText="Continue"
          />
        </form>
      </main>
    </div>
  );
}
