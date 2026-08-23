'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProgress } from '@/components/form-progress'
import { FormCard } from '@/components/form/FormCard'
import { FormSelect } from '@/components/form/FormSelect'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { page4Schema } from '@/lib/validation-schemas'
import { AVAILABLE_STATES } from '@/lib/form-constants'
import { ShieldCheck, DollarSign, Star } from 'lucide-react'
import { LocalizedPage } from '@/components/i18n/LocalizedPage'
import { LanguageSwitch } from '@/components/i18n/LanguageSwitch'

const CURRENT_STEP = 1

type FormData = {
  state: string
}

export default function Home() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(page4Schema),
    defaultValues: {
      state: getFormData().state || '',
    },
  })

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push('/who-is-using')
  }

  return (
    <LocalizedPage>
      <div className="text-foreground min-h-screen bg-white">
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="mb-3 flex justify-end">
          <LanguageSwitch />
        </div>
        {/* Top Bar: Progress + Trust Badges */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <FormProgress currentStep={CURRENT_STEP} />
          </div>

          {/* Horizontal Trust Badges */}
          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs sm:gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary h-4 w-4" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="text-primary h-4 w-4" />
              <span>Money back guarantee</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mb-10 text-center">
          <h1 className="font-display text-foreground mb-4 text-4xl font-bold sm:text-5xl">
            Where are you located?
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Select your state to ensure we can serve you.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormCard spacing="space-y-2">
            <FormSelect
              id="state"
              label="State"
              options={AVAILABLE_STATES}
              placeholder="Select your state"
              register={register('state')}
              error={errors.state}
            />
          </FormCard>

          <FormNavigation backRoute="/" isSubmitting={isSubmitting} />

          {/* Social Proof - Bottom of Form */}
          <div className="space-y-3 pt-4 text-center">
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-muted-foreground text-sm">Trusted by 80,000+ patients nationwide.</p>
          </div>
        </form>
      </main>
      </div>
    </LocalizedPage>
  )
}
