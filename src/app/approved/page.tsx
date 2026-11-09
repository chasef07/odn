'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react'
import { FormLayout } from '@/components/form-layout'
import { FormNavigation } from '@/components/form/FormNavigation'

const NEXT_STEPS = [
  'The doctor will review your chart and contact you if needed.',
  'Your note will be emailed to you.',
  "We'll verify the note if necessary.",
]

export default function ApprovedPage() {
  const router = useRouter()

  return (
    <FormLayout backHref="/review" title="Congratulations!" description="You've been pre-approved.">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          router.push('/payment')
        }}
        className="space-y-5"
      >
        <section className="border-border/60 rounded-xl border bg-white p-5">
          <h2 className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase">
            What happens next
          </h2>
          <ul className="space-y-4">
            {NEXT_STEPS.map((step) => (
              <li key={step} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <span className="text-foreground text-[15px] leading-snug">{step}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-primary/30 bg-primary/5 rounded-xl border p-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-foreground text-[15px] font-semibold">Total due today</span>
            <span className="font-display text-foreground text-3xl font-bold tracking-tight">
              $24.95
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Final step - just $24.95 for your official doctor&apos;s note.
          </p>
          <p className="text-foreground mt-4 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
            100% money-back guarantee.
          </p>
        </section>

        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Secure payment powered by Stripe
        </p>

        <FormNavigation submitText="Continue to Payment" />
      </form>
    </FormLayout>
  )
}
