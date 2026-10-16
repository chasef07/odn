'use client'

import { useEffect } from 'react'
import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm, useWatch, FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Textarea } from '@/components/ui/textarea'
import { FormLayout } from '@/components/form-layout'
import { FormCheckboxGroup } from '@/components/form/FormCheckboxGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { backRoute, includesStep, nextRoute } from '@/lib/intake'
import { symptomsSchema } from '@/lib/validation-schemas'
import { SYMPTOMS_BY_REASON } from '@/lib/form-constants'
import { z } from 'zod'

const ROUTE = '/symptoms'

type FormData = z.infer<typeof symptomsSchema>

export default function SymptomsPage() {
  const router = useRouter()
  const savedData = getFormData()
  const absenceReason = savedData.absenceReason || ''
  const nextAfterSkip = includesStep(ROUTE, savedData) ? null : nextRoute(ROUTE, savedData)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(symptomsSchema),
    defaultValues: {
      symptoms: savedData.symptoms || [],
      otherSymptomText: savedData.otherSymptomText || '',
    },
  })

  useEffect(() => {
    if (nextAfterSkip) router.replace(nextAfterSkip)
  }, [nextAfterSkip, router])

  const symptoms = useWatch({ control, name: 'symptoms' }) || []

  const availableSymptoms = SYMPTOMS_BY_REASON[absenceReason] || []

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  const pageTitle =
    absenceReason === 'Taking care of someone'
      ? 'Who are you taking care of?'
      : 'What symptoms are you experiencing?'

  const pageDescription =
    absenceReason === 'Taking care of someone'
      ? 'Select your relationship to the person.'
      : 'Select all symptoms that apply.'

  const legendText =
    absenceReason === 'Taking care of someone'
      ? 'Select your relationship'
      : 'Select all symptoms that apply'

  return (
    <FormLayout
      route={ROUTE}
      title={pageTitle}
      description={pageDescription}
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormCheckboxGroup
          fieldName="symptoms"
          legend={legendText}
          options={availableSymptoms.map((s) => ({ value: s, label: s }))}
          register={register('symptoms')}
          error={errors.symptoms as FieldError | undefined}
          selectedValues={symptoms}
          gridClassName="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3"
        />

        {symptoms.includes('Other') && (
          <div className="space-y-2">
            <Textarea
              id="otherSymptomText"
              {...register('otherSymptomText')}
              className="border-border/60 focus-visible:ring-primary/40 min-h-[80px] resize-none rounded-xl text-base focus-visible:ring-2"
              placeholder="Please describe..."
              aria-required="true"
              aria-invalid={!!errors.otherSymptomText}
              aria-describedby={errors.otherSymptomText ? 'otherSymptomText-error' : undefined}
            />
            {errors.otherSymptomText && (
              <p id="otherSymptomText-error" className="text-sm text-red-500">
                {errors.otherSymptomText.message}
              </p>
            )}
          </div>
        )}

        <FormNavigation backRoute={backRoute(ROUTE, savedData)} isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
