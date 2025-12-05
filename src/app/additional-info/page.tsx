'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Textarea } from '@/components/ui/textarea'
import { FormLayout } from '@/components/form-layout'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { page9Schema } from '@/lib/validation-schemas'

// Step number will be dynamic based on recipient

type FormData = {
  additionalInformation?: string
}

export default function AdditionalInfoPage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'
  const currentStep = recipient === 'someone_else' ? 10 : 9
  const absenceReason = savedData.absenceReason || ''

  // Dynamic back route: skip symptoms page for Doctor's appointment and Other
  const backRoute =
    absenceReason === "Doctor's appointment" || absenceReason === 'Other'
      ? '/absence-reason'
      : '/symptoms'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(page9Schema),
    defaultValues: {
      additionalInformation: savedData.additionalInformation || '',
    },
  })

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push('/review')
  }

  return (
    <FormLayout
      currentStep={currentStep}
      title="Any additional information?"
      description="Share any other details that might be helpful for your doctor's note (optional)."
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Textarea
            id="additionalInformation"
            {...register('additionalInformation')}
            className="border-border/60 focus-visible:ring-primary/40 min-h-[150px] resize-none rounded-xl text-base focus-visible:ring-2"
            placeholder="Enter any additional information here..."
            aria-describedby={
              errors.additionalInformation ? 'additionalInformation-error' : undefined
            }
          />
          {errors.additionalInformation && (
            <p id="additionalInformation-error" className="text-sm text-red-500">
              {errors.additionalInformation.message}
            </p>
          )}
        </div>

        <FormNavigation backRoute={backRoute} isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
