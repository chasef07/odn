'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import { LocalizedPage } from '@/components/i18n/LocalizedPage'
import { LanguageSwitch } from '@/components/i18n/LanguageSwitch'

export default function ApprovedPage() {
  const router = useRouter()

  return (
    <LocalizedPage>
      <div className="text-foreground min-h-dvh bg-white">
        <main className="mx-auto max-w-4xl px-4 py-8 text-center sm:px-6 sm:py-12">
          <div className="mb-6 flex justify-end">
            <LanguageSwitch />
          </div>
          <h1 className="font-display text-foreground mb-6 text-3xl font-bold sm:mb-10 sm:text-5xl">
            Congratulations!
          </h1>

          <div className="mx-auto mb-8 max-w-xl space-y-5 text-left sm:mb-10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <p className="text-foreground text-lg">You&apos;ve been pre-approved.</p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <p className="text-foreground text-lg">
                The doctor will review your chart and contact you if needed.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <p className="text-foreground text-lg">Your note will be emailed to you.</p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <p className="text-foreground text-lg">We&apos;ll verify the note if necessary.</p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <p className="text-foreground text-lg">100% money-back guarantee.</p>
            </div>
          </div>

          <p className="text-muted-foreground mb-8 text-lg sm:text-xl">
            Final step - just $24.95 for your official doctor&apos;s note.
          </p>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push('/review')}
              className="text-foreground hover:bg-accent inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => router.push('/payment')}
              className="bg-primary hover:bg-primary/90 inline-flex flex-1 items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white shadow-sm transition-all sm:flex-none"
            >
              Continue
            </button>
          </div>
        </main>
      </div>
    </LocalizedPage>
  )
}
