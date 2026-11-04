'use client'

import { useState } from 'react'
import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormSelect } from '@/components/form/FormSelect'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { stateSchema } from '@/lib/validation-schemas'
import { nextRoute } from '@/lib/intake'
import { AVAILABLE_STATES } from '@/lib/form-constants'
import { MapPin, Star } from 'lucide-react'

const ROUTE = '/get-started'

type FormData = {
  state: string
}

export function GetStartedForm({ detectedState }: { detectedState: string | null }) {
  const router = useRouter()
  const [confirmingDetected, setConfirmingDetected] = useState(detectedState !== null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(stateSchema),
    defaultValues: {
      state: detectedState || getFormData().state || '',
    },
  })

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  return (
    <FormLayout
      route={ROUTE}
      backHref="/"
      title="Where are you located?"
      description="Select your state to ensure we can serve you."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {confirmingDetected ? (
          <div className="border-primary bg-primary/5 flex items-center gap-4 rounded-xl border p-4">
            <span className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                We detected you&apos;re in
              </p>
              <p className="font-display text-foreground text-xl font-bold">{detectedState}</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmingDetected(false)}
              className="text-primary shrink-0 text-sm font-semibold underline-offset-4 hover:underline"
            >
              Choose a different state
            </button>
          </div>
        ) : (
          <FormSelect
            id="state"
            label="State"
            options={AVAILABLE_STATES}
            placeholder="Select your state"
            translateOptions={false}
            register={register('state')}
            autoComplete="address-level1"
            error={errors.state}
          />
        )}

        <FormNavigation isSubmitting={isSubmitting} />

        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="text-muted-foreground text-sm">Trusted by 80,000+ patients nationwide.</p>
        </div>
      </form>
    </FormLayout>
  )
}
