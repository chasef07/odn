'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Textarea } from '@/components/ui/textarea'
import { FormLayout } from '@/components/form-layout'
import { FormCheckboxGroup } from '@/components/form/FormCheckboxGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { page8Schema } from '@/lib/validation-schemas'
import { SYMPTOMS_BY_REASON } from '@/lib/form-constants'
import { z } from 'zod'

// Step number will be dynamic based on recipient

type FormData = z.infer<typeof page8Schema>

export default function SymptomsPage() {
  const router = useRouter()
  const savedData = getFormData()
  const absenceReason = savedData.absenceReason || ''
  const recipient = savedData.recipient || 'myself'
  const currentStep = recipient === 'someone_else' ? 9 : 8

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(page8Schema),
    defaultValues: {
      symptoms: savedData.symptoms || [],
      otherSymptomText: savedData.otherSymptomText || '',
    },
  })

  // Redirect if this page shouldn't be shown for this absence reason
  useEffect(() => {
    if (absenceReason === "Doctor's appointment" || absenceReason === 'Other') {
      router.push('/additional-info')
    }
  }, [absenceReason, router])

  const symptoms = watch('symptoms') || []

  // Get available symptoms based on absence reason
  const availableSymptoms = SYMPTOMS_BY_REASON[absenceReason] || []

  const onSubmit = (data: FormData) => {
    // Validation
    if (!data.symptoms || data.symptoms.length === 0) {
      const errorMessage =
        absenceReason === 'Taking care of someone'
          ? 'Please select your relationship'
          : 'Please select at least one symptom'
      setError('symptoms', {
        message: errorMessage,
      })
      return
    }

    // If "Other" symptom is selected, require text description
    if (data.symptoms.includes('Other') && !data.otherSymptomText?.trim()) {
      setError('otherSymptomText', {
        message: 'Please describe other symptoms',
      })
      return
    }

    saveFormData(data)
    router.push('/additional-info')
  }

  // Dynamic title and description based on absence reason
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
      currentStep={currentStep}
      title={pageTitle}
      description={pageDescription}
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
        <FormCheckboxGroup
          fieldName="symptoms"
          legend={legendText}
          options={availableSymptoms.map((s) => ({ value: s, label: s }))}
          register={register('symptoms')}
          error={errors.symptoms as FieldError | undefined}
          selectedValues={symptoms}
        />

        {/* Show text input when "Other" is selected */}
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

        <FormNavigation backRoute="/absence-reason" isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
