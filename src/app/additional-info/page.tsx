'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Textarea } from '@/components/ui/textarea'
import { FormLayout } from '@/components/form-layout'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { backRoute, nextRoute } from '@/lib/intake'
import { additionalInfoSchema } from '@/lib/validation-schemas'
import type { z } from 'zod'

const ROUTE = '/additional-info'

type FormData = z.input<typeof additionalInfoSchema>

export default function AdditionalInfoPage() {
  const router = useRouter()
  const savedData = getFormData()
  const absenceReason = savedData.absenceReason || ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(additionalInfoSchema),
    defaultValues: {
      additionalInformation: savedData.additionalInformation || '',
    },
  })

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  const isAppointment = absenceReason === "Doctor's appointment"
  const title = isAppointment ? 'Additional information needed.' : 'Any additional information?'
  const description = isAppointment
    ? 'Please let us know what type of appointment you have. If more than 1 day has been requested, do you have multiple appointments or a planned medical procedure. Also, please share any other helpful details.'
    : "Share any other details that might be helpful for your doctor's note (optional)."

  return (
    <FormLayout route={ROUTE} title={title} description={description} usePersonalization={true}>
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
          <p className="text-muted-foreground text-sm">
            Please note: Your information is always confidential and protected by HIPAA.
          </p>
        </div>

        <FormNavigation backRoute={backRoute(ROUTE, savedData)} isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
