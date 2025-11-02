'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { Input } from '@/components/ui/input'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { page7Schema } from '@/lib/validation-schemas'
import { ABSENCE_REASONS } from '@/lib/form-constants'

// Step number will be dynamic based on recipient

type FormData = {
  absenceReason: string | null
  otherAbsenceReason?: string
}

export default function AbsenceReasonPage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'
  // Use guardian's first name if available (someone_else), otherwise use patient's first name
  const firstName = savedData.guardianFirstName || savedData.patientFirstName || ''
  const currentStep = recipient === 'someone_else' ? 8 : 7

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(page7Schema),
    defaultValues: getFormData(),
  })

  const selectedReason = watch('absenceReason')

  // Build absence reason options from constants
  const absenceReasonOptions = [...ABSENCE_REASONS]

  const onSubmit = (data: FormData) => {
    // Clear symptoms when absence reason changes
    const previousReason = savedData.absenceReason
    if (previousReason !== data.absenceReason) {
      saveFormData({ ...data, symptoms: [], otherSymptomText: '' })
    } else {
      saveFormData(data)
    }

    // Skip symptoms page for Doctor's appointment and Other
    if (data.absenceReason === "Doctor's appointment" || data.absenceReason === 'Other') {
      router.push('/additional-info')
    } else {
      router.push('/symptoms')
    }
  }

  const title = firstName
    ? `What's the reason for your absence, ${firstName}?`
    : 'What is your reason for absence?'

  return (
    <FormLayout currentStep={currentStep} title={title} description="" usePersonalization={true}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormRadioGroup
          fieldName="absenceReason"
          legend="What is your reason for absence?"
          options={absenceReasonOptions.map((r) => ({ value: r, label: r }))}
          register={register('absenceReason')}
          error={errors.absenceReason}
          selectedValue={selectedReason ?? undefined}
          gridClassName="grid gap-3 sm:grid-cols-2"
        />

        {/* Show text input when "Other" is selected */}
        {selectedReason === 'Other' && (
          <div className="space-y-2">
            <Input
              id="otherAbsenceReason"
              type="text"
              {...register('otherAbsenceReason')}
              className="border-border/60 focus-visible:ring-primary/40 h-12 rounded-xl text-base focus-visible:ring-2"
              placeholder="Please specify the reason..."
              aria-required="true"
              aria-invalid={!!errors.otherAbsenceReason}
              aria-describedby={errors.otherAbsenceReason ? 'otherAbsenceReason-error' : undefined}
            />
            {errors.otherAbsenceReason && (
              <p id="otherAbsenceReason-error" className="text-sm text-red-500">
                {errors.otherAbsenceReason.message}
              </p>
            )}
          </div>
        )}

        <FormNavigation backRoute="/absence-dates" isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
