'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { LocalizedPage } from '@/components/i18n/LocalizedPage'
import { LanguageSwitch } from '@/components/i18n/LanguageSwitch'
import { useFunnelStep } from '@/components/useFunnelStep'

export default function LandingPage() {
  const router = useRouter()
  useFunnelStep('/start')

  return (
    <LocalizedPage>
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-2xl px-6 py-12 text-center">
          <div className="mb-6 flex justify-end">
            <LanguageSwitch />
          </div>
          <h1 className="font-display text-foreground mb-4 text-4xl font-bold sm:text-5xl">
            Need a quick doctor&apos;s note for work or school?
          </h1>

          <p className="text-muted-foreground mb-8 text-2xl">You&apos;re in the right place.</p>

          <div className="mx-auto mb-8 max-w-xl space-y-4 text-left">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <p className="text-foreground text-lg">
                <span className="font-semibold">Easy</span> - 100% online
              </p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <p className="text-foreground text-lg">
                <span className="font-semibold">Affordable</span> - only $24.95
              </p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <p className="text-foreground text-lg">
                <span className="font-semibold">Valid</span> - signed by a board-certified physician
                licensed in your state
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push('/get-started')}
            className="bg-primary hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl px-12 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-xl"
          >
            Request My Note
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className="mx-auto mt-6 max-w-xl">
            <p className="text-muted-foreground text-sm leading-relaxed">
              <span className="font-medium">Please note:</span> We do not provide documentation for
              legal matters including probation / court appearances, FMLA, workers&apos;
              compensation, disability, or insurance claims under any circumstances. Requests for
              these purposes will be denied. Users must be 18+ or a parent/guardian requesting on
              behalf of a minor.
            </p>
          </div>
        </main>
      </div>
    </LocalizedPage>
  )
}
