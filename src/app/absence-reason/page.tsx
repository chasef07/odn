'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { Input } from '@/components/ui/input'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { getBackRoute, getNextRoute, getStepNumber } from '@/lib/form-steps'
import { page7Schema } from '@/lib/validation-schemas'
import { ABSENCE_REASONS } from '@/lib/form-constants'
import { useI18n } from '@/components/i18n/I18nProvider'

type FormData = {
  absenceReason: string | null
  otherAbsenceReason?: string
}

export default function AbsenceReasonPage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'
  const patientFirstName = savedData.patientFirstName || ''
  const currentStep = getStepNumber('/absence-reason', recipient)
  const { locale } = useI18n()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(page7Schema),
    defaultValues: getFormData(),
  })

  const selectedReason = useWatch({ control, name: 'absenceReason' })

  const absenceReasonOptions = [...ABSENCE_REASONS]

  const onSubmit = (data: FormData) => {
    const previousReason = savedData.absenceReason
    if (previousReason !== data.absenceReason) {
      saveFormData({ ...data, symptoms: [], otherSymptomText: '' })
    } else {
      saveFormData(data)
    }

    if (data.absenceReason === "Doctor's appointment" || data.absenceReason === 'Other') {
      router.push(getNextRoute('/symptoms', recipient)!)
    } else {
      router.push(getNextRoute('/absence-reason', recipient)!)
    }
  }

  const title = patientFirstName
    ? locale === 'es'
      ? `¿Cuál es el motivo de la ausencia de ${patientFirstName}?`
      : `What's the reason for ${patientFirstName}'s absence?`
    : 'What is your reason for absence?'

  return (
    <FormLayout currentStep={currentStep} title={title} description="" usePersonalization={true}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormRadioGroup
          fieldName="absenceReason"
          legend="What is your reason for absence?"
          options={absenceReasonOptions.map((r) => ({ value: r, label: r }))}
          register={register('absenceReason')}
          error={errors.absenceReason}
          selectedValue={selectedReason ?? undefined}
          gridClassName="grid gap-2.5 sm:grid-cols-2"
        />

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

        <FormNavigation
          backRoute={getBackRoute('/absence-reason', recipient)!}
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  )
}
